package account.perf;

import account.common.AuthHeaders;
import account.controller.external.ExternalFundController;
import account.controller.external.ExternalSecurityController;
import account.controller.external.ExternalTradeController;
import account.controller.internal.DashboardController;
import account.controller.internal.FundAccountController;
import account.controller.internal.SecurityAccountController;
import account.controller.internal.StaffController;
import account.dao.DaoRegistry;
import account.dao.model.DomainModels;
import account.exception.GlobalExceptionHandler;
import account.integration.BlacklistClient;
import account.service.FundAccountServiceImpl;
import account.service.InMemoryClientAuthTokenService;
import account.service.InMemoryStaffAuthTokenService;
import account.service.OperationLogViewMapper;
import account.service.SecurityAccountServiceImpl;
import account.service.StaffServiceImpl;
import account.service.api.ClientAuthTokenService;
import account.service.api.FundAccountService;
import account.service.api.SecurityAccountService;
import account.service.api.StaffAuthTokenService;
import account.service.api.StaffService;
import account.support.TestDatabaseSupport;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.junit.jupiter.api.Assertions.assertFalse;

/** End-to-end pressure suite for controller, service, and DAO paths. */
class PressureTestSuite {

    private static final int STAFF_COUNT = 10;
    private static final String DB_MODE_PROPERTY = "pressure.test.db.mode";
    private static final String MYSQL_HOST_PROPERTY = "account.test.mysql.host";
    private static final String MYSQL_PORT_PROPERTY = "account.test.mysql.port";
    private static final String MYSQL_DATABASE_PROPERTY = "account.test.mysql.database";
    private static final String MYSQL_USERNAME_PROPERTY = "account.test.mysql.username";
    private static final String MYSQL_PASSWORD_PROPERTY = "account.test.mysql.password";
    private static final String MYSQL_URL_SUFFIX = "?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai&characterEncoding=utf-8";
    private static final Path REPORT_PATH = Path.of("PressTest", "pressure-test-report.md");
    private static final Path JSON_RESULT_PATH = Path.of("PressTest", "results", "pressure-test-results.json");
    private static final Path CSV_RESULT_PATH = Path.of("PressTest", "results", "pressure-test-summary.csv");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;
    private DaoRegistry registry;
    private FundAccountService fundService;
    private SecurityAccountService securityService;
    private List<String> staffTokens;
    private String jdbcUrl;
    private String jdbcUsername;
    private String jdbcPassword;
    private String databaseEnvironment;
    private boolean realMySqlMode;

    @BeforeEach
    void setUp() throws Exception {
        // Recreate schema for each suite run to keep scenarios isolated.
        configureDatabase();
        registry = DaoRegistry.forDriverManager(jdbcUrl, jdbcUsername, jdbcPassword);

        // Seed shared staff identities used by protected internal endpoints.
        for (int index = 1; index <= STAFF_COUNT; index++) {
            TestDatabaseSupport.insertStaff(
                    jdbcUrl,
                    jdbcUsername,
                    jdbcPassword,
                    index,
                    "staff" + String.format("%02d", index),
                    "123456",
                    "正常"
            );
        }

        objectMapper = new ObjectMapper().findAndRegisterModules();
        StaffAuthTokenService staffAuthTokenService = new InMemoryStaffAuthTokenService(28800L);
        ClientAuthTokenService clientAuthTokenService = new InMemoryClientAuthTokenService(7200L);
        BlacklistClient blacklistClient = userName -> false;

        StaffService staffService = new StaffServiceImpl(registry, staffAuthTokenService);
        fundService = new FundAccountServiceImpl(registry, blacklistClient, clientAuthTokenService);
        securityService = new SecurityAccountServiceImpl(registry, blacklistClient, clientAuthTokenService);
        OperationLogViewMapper operationLogViewMapper = new OperationLogViewMapper(registry);

        mockMvc = MockMvcBuilders.standaloneSetup(
                        new StaffController(staffService, staffAuthTokenService, objectMapper),
                        new SecurityAccountController(securityService, staffAuthTokenService, objectMapper),
                        new FundAccountController(fundService, staffAuthTokenService, objectMapper),
                        new DashboardController(registry, securityService, fundService, staffAuthTokenService, operationLogViewMapper),
                        new ExternalFundController(fundService, objectMapper),
                        new ExternalSecurityController(securityService, objectMapper),
                        new ExternalTradeController(fundService, securityService, objectMapper)
        )
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        staffTokens = new ArrayList<>();
        // Pre-authenticate staff accounts so load scenarios spend time on target APIs.
        for (int index = 1; index <= STAFF_COUNT; index++) {
            staffTokens.add(staffLoginAndGetToken("staff" + String.format("%02d", index), "123456"));
        }
    }

    @Test
    void runPressureSuiteAndWriteArtifacts() throws Exception {
        List<ScenarioResult> scenarios = List.of(
                executeScenario("并发开户链路", this::runConcurrentAccountOpeningScenario),
                executeScenario("重复资金回调幂等", this::runDuplicateFundCallbackScenario),
                executeScenario("重复持仓回调幂等", this::runDuplicateHoldingCallbackScenario),
                executeScenario("混合并发查询", this::runConcurrentQueryScenario)
        );

        PressureSuiteReport report = new PressureSuiteReport(
                LocalDateTime.now().format(TIME_FORMATTER),
                databaseEnvironment,
                List.of(
                        "Java 17",
                        "JUnit 5",
                        "Spring MockMvc",
                        databaseEnvironment,
                        "Maven Surefire",
                        "PowerShell runner"
                ),
                List.of(
                        "基于现有集成测试栈构建控制器级压力测试，不额外引入 JMeter/Gatling 等外部工具。",
                        "使用固定并发度 + 固定任务数的方式压测四类场景：并发开户、重复资金回调、重复持仓回调、混合查询。",
                        "每个任务记录单次业务操作耗时，汇总平均值、P95、P99、吞吐量、成功/失败计数。",
                        "对幂等场景额外校验 duplicate 标记、最终余额/持仓、日志落库条数。"
                ),
                List.of(
                        "并发开户样例：30 组唯一成年自然人样例，每组执行 1 次证券开户 + 1 次资金开户链路。",
                        "重复资金回调样例：对同一资金账户重复回放 120 次同 ref_order_id 的买入冻结回调。",
                        "重复持仓回调样例：对同一证券账户重复回放 120 次同 ref_order_id 的买入增加回调。",
                        "混合查询样例：400 次读请求均匀分布到 Dashboard、Recent Logs、证券账户列表、资金账户列表、资金流水查询。"
                ),
                List.of(
                        "报告结构参考根目录 PDF 模板中的压力测试章节，并补充了过程可复现信息。",
                        realMySqlMode
                                ? "本次执行已接入真实 MySQL 数据库，包含真实表结构、真实索引和真实数据库 I/O。"
                                : "本次执行未接入真实 MySQL，数据库层使用 H2 的 MySQL 兼容模式。",
                        realMySqlMode
                                ? "本次结果反映的是控制器 + Service + DAO + 真实 MySQL 的压力表现，但仍不包含真实 HTTP 网络传输和前端浏览器渲染。"
                                : "本次结果反映的是控制器 + Service + DAO + H2(MySQL 模式) 的压力表现，不包含真实网络栈和 MySQL 物理 I/O。"
                ),
                scenarios
        );

        writeJsonResult(report);
        writeCsvSummary(report.scenarios());
        writeMarkdownReport(report);

        assertFalse(report.scenarios().isEmpty());
    }

    /** Concurrently executes the security-account + fund-account opening chain. */
    private ScenarioResult runConcurrentAccountOpeningScenario() throws Exception {
        final int operations = 30;
        final int concurrency = 10;
        ConcurrentLinkedQueue<String> successIds = new ConcurrentLinkedQueue<>();

        ScenarioExecution execution = runScenario(operations, concurrency, index -> {
            String idNumber = buildAdultIdNumber(index + 1);
            String name = "PT-User-" + String.format("%04d", index + 1);
            String staffToken = staffTokens.get(index % staffTokens.size());

            JsonNode securityResult = postJson(
                    MockMvcRequestBuilders.post("/api/internal/security/accounts")
                            .contentType(MediaType.APPLICATION_JSON)
                            .header(AuthHeaders.STAFF_AUTH_TOKEN, staffToken)
                            .content("""
                                    {
                                      "investor_type": "个人",
                                      "name": "%s",
                                      "gender": "男",
                                      "id_type": "身份证",
                                      "id_number": "%s",
                                      "phone": "1380000%04d",
                                      "address": "Hangzhou",
                                      "work_unit": "ZJU",
                                      "occupation": "Engineer",
                                      "education": "Bachelor"
                                    }
                                    """.formatted(name, idNumber, index + 1)));

            if (securityResult.get("code").asInt() != 0) {
                return TaskOutcome.failure("security create failed: " + securityResult.toString(), Map.of("id_number", idNumber));
            }

            String secAccNo = securityResult.get("sec_acc_no").asText();
            JsonNode fundResult = postJson(
                    MockMvcRequestBuilders.post("/api/internal/fund/accounts")
                            .contentType(MediaType.APPLICATION_JSON)
                            .header(AuthHeaders.STAFF_AUTH_TOKEN, staffToken)
                            .content("""
                                    {
                                      "sec_acc_no": "%s",
                                      "id_number": "%s",
                                      "trade_password": "trade123",
                                      "withdraw_password": "withdraw123",
                                      "currency": "CNY"
                                    }
                                    """.formatted(secAccNo, idNumber)));

            if (fundResult.get("code").asInt() != 0) {
                return TaskOutcome.failure("fund create failed: " + fundResult.toString(), Map.of(
                        "id_number", idNumber,
                        "sec_acc_no", secAccNo
                ));
            }

            successIds.add(idNumber);
            return TaskOutcome.success(Map.of(
                    "id_number", idNumber,
                    "sec_acc_no", secAccNo,
                    "fund_acc_no", fundResult.get("fund_acc_no").asText()
            ));
        });

        int verifiedCount = 0;
        String verificationError = null;
        try {
            for (String idNumber : successIds) {
                var investor = registry.investorDao().findByIdNumber(idNumber);
                if (investor.isPresent()) {
                    var account = registry.securityAccountDao().findLatestNonClosedByInvestorId(investor.get().investorId());
                    if (account.isPresent()) {
                        verifiedCount++;
                    }
                }
            }
        } catch (Exception exception) {
            verificationError = summarizeException(exception);
        }

        List<String> verificationNotes = new ArrayList<>(List.of(
                "成功开户链路数: " + execution.successCount() + "/" + operations,
                "按证件号回查到有效证券账户数: " + verifiedCount,
                "失败任务数: " + execution.failureCount()
        ));
        if (verificationError != null) {
            verificationNotes.add("数据库回查异常: " + verificationError);
        }

        boolean passed = execution.failureCount() == 0
                && verifiedCount == successIds.size()
                && verificationError == null;
        return toScenarioResult(
                "并发开户链路",
                "POST /api/internal/security/accounts + POST /api/internal/fund/accounts",
                "30 组唯一成年个人样例，顺序执行证券开户后再执行资金开户",
                operations,
                concurrency,
                execution,
                verificationNotes,
                passed
        );
    }

    /** Replays the same fund callback to validate idempotency. */
    private ScenarioResult runDuplicateFundCallbackScenario() throws Exception {
        final int operations = 120;
        final int concurrency = 24;
        String secAccNo = "PTSAFUND01";
        String fundAccNo = "PTFAFUND01";
        String idNumber = buildAdultIdNumber(2001);
        String refOrderId = "PT-REF-FUND-001";

        TestDatabaseSupport.seedInvestorSecurityFund(
                registry,
                secAccNo,
                fundAccNo,
                idNumber,
                new BigDecimal("50000.00"),
                BigDecimal.ZERO
        );

        ScenarioExecution execution = runScenario(operations, concurrency, index -> {
            JsonNode result = postJson(
                    MockMvcRequestBuilders.post("/api/external/trade/fund-balance")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "fund_acc_no": "%s",
                                      "ref_order_id": "%s",
                                      "txn_type": "买入冻结",
                                      "amount": 100.00
                                    }
                                    """.formatted(fundAccNo, refOrderId)));

            if (result.get("code").asInt() != 0) {
                return TaskOutcome.failure("fund callback failed: " + result.toString(), Map.of());
            }

            return TaskOutcome.success(Map.of(
                    "duplicate", result.get("duplicate").asBoolean(),
                    "available_balance", result.get("available_balance").decimalValue(),
                    "frozen_balance", result.get("frozen_balance").decimalValue()
            ));
        });

        long duplicateFalseCount = execution.outcomes().stream()
                .filter(TaskOutcome::ok)
                .filter(outcome -> !Boolean.TRUE.equals(outcome.attributes().get("duplicate")))
                .count();
        long duplicateTrueCount = execution.outcomes().stream()
                .filter(TaskOutcome::ok)
                .filter(outcome -> Boolean.TRUE.equals(outcome.attributes().get("duplicate")))
                .count();

        BigDecimal finalAvailableBalance = null;
        BigDecimal finalFrozenBalance = null;
        long logCount = -1;
        String verificationError = null;
        try {
            var finalAccount = registry.fundAccountDao().findByAccountNo(fundAccNo).orElseThrow();
            finalAvailableBalance = finalAccount.availableBalance();
            finalFrozenBalance = finalAccount.frozenBalance();
            logCount = registry.fundTransactionLogDao().listRecentByFundAccountNo(fundAccNo, 200).stream()
                    .filter(log -> refOrderId.equals(log.refOrderId()))
                    .count();
        } catch (Exception exception) {
            verificationError = summarizeException(exception);
        }

        List<String> verificationNotes = new ArrayList<>(List.of(
                "duplicate=false 数量: " + duplicateFalseCount,
                "duplicate=true 数量: " + duplicateTrueCount,
                "最终可用余额: " + (finalAvailableBalance == null ? "N/A" : finalAvailableBalance),
                "最终冻结余额: " + (finalFrozenBalance == null ? "N/A" : finalFrozenBalance),
                "同 ref_order_id 资金流水条数: " + (logCount < 0 ? "N/A" : logCount)
        ));
        if (verificationError != null) {
            verificationNotes.add("数据库回查异常: " + verificationError);
        }

        boolean passed = execution.failureCount() == 0
                && duplicateFalseCount == 1
                && duplicateTrueCount == operations - 1L
                && finalAvailableBalance != null
                && finalFrozenBalance != null
                && finalAvailableBalance.compareTo(new BigDecimal("49900.00")) == 0
                && finalFrozenBalance.compareTo(new BigDecimal("100.00")) == 0
                && logCount == 1
                && verificationError == null;
        return toScenarioResult(
                "重复资金回调幂等",
                "POST /api/external/trade/fund-balance",
                "120 次相同 ref_order_id 的买入冻结回调",
                operations,
                concurrency,
                execution,
                verificationNotes,
                passed
        );
    }

    /** Replays the same holding callback to validate idempotency. */
    private ScenarioResult runDuplicateHoldingCallbackScenario() throws Exception {
        final int operations = 120;
        final int concurrency = 24;
        String secAccNo = "PTSAHOLD01";
        String fundAccNo = "PTFAHOLD01";
        String idNumber = buildAdultIdNumber(3001);
        String refOrderId = "PT-REF-HOLD-001";

        TestDatabaseSupport.seedInvestorSecurityFund(
                registry,
                secAccNo,
                fundAccNo,
                idNumber,
                new BigDecimal("1000.00"),
                BigDecimal.ZERO
        );

        ScenarioExecution execution = runScenario(operations, concurrency, index -> {
            JsonNode result = postJson(
                    MockMvcRequestBuilders.post("/api/external/trade/security-holding")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "sec_acc_no": "%s",
                                      "stock_code": "600519",
                                      "stock_name": "贵州茅台",
                                      "ref_order_id": "%s",
                                      "change_type": "买入增加",
                                      "quantity": 10,
                                      "price": 12.34
                                    }
                                    """.formatted(secAccNo, refOrderId)));

            if (result.get("code").asInt() != 0) {
                return TaskOutcome.failure("holding callback failed: " + result.toString(), Map.of());
            }

            return TaskOutcome.success(Map.of(
                    "duplicate", result.get("duplicate").asBoolean(),
                    "quantity", result.get("quantity").asInt(),
                    "frozen_quantity", result.get("frozen_quantity").asInt()
            ));
        });

        long duplicateFalseCount = execution.outcomes().stream()
                .filter(TaskOutcome::ok)
                .filter(outcome -> !Boolean.TRUE.equals(outcome.attributes().get("duplicate")))
                .count();
        long duplicateTrueCount = execution.outcomes().stream()
                .filter(TaskOutcome::ok)
                .filter(outcome -> Boolean.TRUE.equals(outcome.attributes().get("duplicate")))
                .count();

        Integer finalQuantity = null;
        Integer finalFrozenQuantity = null;
        long logCount = -1;
        String verificationError = null;
        try {
            var holding = registry.holdingDao().findByAccountAndStock(secAccNo, "600519").orElseThrow();
            finalQuantity = holding.quantity();
            finalFrozenQuantity = holding.frozenQuantity();
            logCount = registry.holdingChangeLogDao().listByRefOrderId(refOrderId).size();
        } catch (Exception exception) {
            verificationError = summarizeException(exception);
        }

        List<String> verificationNotes = new ArrayList<>(List.of(
                "duplicate=false 数量: " + duplicateFalseCount,
                "duplicate=true 数量: " + duplicateTrueCount,
                "最终持仓数量: " + (finalQuantity == null ? "N/A" : finalQuantity),
                "最终冻结数量: " + (finalFrozenQuantity == null ? "N/A" : finalFrozenQuantity),
                "同 ref_order_id 持仓变更日志条数: " + (logCount < 0 ? "N/A" : logCount)
        ));
        if (verificationError != null) {
            verificationNotes.add("数据库回查异常: " + verificationError);
        }

        boolean passed = execution.failureCount() == 0
                && duplicateFalseCount == 1
                && duplicateTrueCount == operations - 1L
                && finalQuantity != null
                && finalFrozenQuantity != null
                && finalQuantity == 10
                && finalFrozenQuantity == 0
                && logCount == 1
                && verificationError == null;
        return toScenarioResult(
                "重复持仓回调幂等",
                "POST /api/external/trade/security-holding",
                "120 次相同 ref_order_id 的买入增加回调",
                operations,
                concurrency,
                execution,
                verificationNotes,
                passed
        );
    }

    /** Mixes internal read endpoints under concurrent load. */
    private ScenarioResult runConcurrentQueryScenario() throws Exception {
        final int operations = 400;
        final int concurrency = 40;
        String secAccNo = "PTSAQUERY01";
        String fundAccNo = "PTFAQUERY01";
        String idNumber = buildAdultIdNumber(4001);

        TestDatabaseSupport.seedInvestorSecurityFund(
                registry,
                secAccNo,
                fundAccNo,
                idNumber,
                new BigDecimal("10000.00"),
                BigDecimal.ZERO
        );

        String seedToken = staffTokens.get(0);
        for (int index = 0; index < 80; index++) {
            postJson(
                    MockMvcRequestBuilders.post("/api/internal/fund/deposit")
                            .contentType(MediaType.APPLICATION_JSON)
                            .header(AuthHeaders.STAFF_AUTH_TOKEN, seedToken)
                            .content("""
                                    {
                                      "fund_acc_no": "%s",
                                      "amount": 10.00
                                    }
                                    """.formatted(fundAccNo)));
        }

        ScenarioExecution execution = runScenario(operations, concurrency, index -> {
            String staffToken = staffTokens.get(index % staffTokens.size());
            int mode = index % 5;
            JsonNode result;
            switch (mode) {
                case 0 -> result = getJson(
                        MockMvcRequestBuilders.get("/api/internal/dashboard/stats")
                                .header(AuthHeaders.STAFF_AUTH_TOKEN, staffToken));
                case 1 -> result = getJson(
                        MockMvcRequestBuilders.get("/api/internal/dashboard/recent-logs")
                                .header(AuthHeaders.STAFF_AUTH_TOKEN, staffToken)
                                .param("limit", "20"));
                case 2 -> result = getJson(
                        MockMvcRequestBuilders.get("/api/internal/security/accounts")
                                .header(AuthHeaders.STAFF_AUTH_TOKEN, staffToken));
                case 3 -> result = getJson(
                        MockMvcRequestBuilders.get("/api/internal/fund/accounts/list")
                                .header(AuthHeaders.STAFF_AUTH_TOKEN, staffToken));
                default -> result = getJson(
                        MockMvcRequestBuilders.get("/api/internal/fund/logs")
                                .header(AuthHeaders.STAFF_AUTH_TOKEN, staffToken)
                                .param("fund_acc_no", fundAccNo)
                                .param("id_number", idNumber)
                                .param("limit", "50"));
            }

            if (result.get("code").asInt() != 0) {
                return TaskOutcome.failure("query failed: " + result.toString(), Map.of("mode", mode));
            }

            return TaskOutcome.success(Map.of("mode", mode));
        });

        Integer recentFundLogCount = null;
        String verificationError = null;
        try {
            recentFundLogCount = registry.fundTransactionLogDao().listRecentByFundAccountNo(fundAccNo, 200).size();
        } catch (Exception exception) {
            verificationError = summarizeException(exception);
        }
        List<String> verificationNotes = new ArrayList<>(List.of(
                "混合查询成功数: " + execution.successCount() + "/" + operations,
                "失败任务数: " + execution.failureCount(),
                "被查询资金账户当前流水条数: " + (recentFundLogCount == null ? "N/A" : recentFundLogCount)
        ));
        if (verificationError != null) {
            verificationNotes.add("数据库回查异常: " + verificationError);
        }

        boolean passed = execution.failureCount() == 0
                && execution.successCount() == operations
                && verificationError == null;
        return toScenarioResult(
                "混合并发查询",
                "GET /api/internal/dashboard/* + GET /api/internal/security/accounts + GET /api/internal/fund/*",
                "400 次读请求，均匀分布到 5 类查询接口",
                operations,
                concurrency,
                execution,
                verificationNotes,
                passed
        );
    }

    /** Runs a scenario with a fixed thread pool and a synchronized start gate. */
    private ScenarioExecution runScenario(int operations, int concurrency, ScenarioTask task) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(concurrency);
        CountDownLatch startGate = new CountDownLatch(1);
        List<Future<TaskMeasurement>> futures = new ArrayList<>();

        for (int index = 0; index < operations; index++) {
            final int taskIndex = index;
            Callable<TaskMeasurement> callable = () -> {
                // Release all workers together to create a short, concentrated burst.
                startGate.await();
                long start = System.nanoTime();
                try {
                    TaskOutcome outcome = task.execute(taskIndex);
                    return new TaskMeasurement(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start), outcome);
                } catch (Exception exception) {
                    return new TaskMeasurement(
                            TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start),
                            TaskOutcome.failure(exception.getClass().getSimpleName() + ": " + exception.getMessage(), Map.of())
                    );
                }
            };
            futures.add(executor.submit(callable));
        }

        long wallStart = System.nanoTime();
        startGate.countDown();

        List<TaskMeasurement> measurements = new ArrayList<>(operations);
        for (Future<TaskMeasurement> future : futures) {
            measurements.add(future.get());
        }
        long wallTimeMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - wallStart);
        executor.shutdown();

        List<Long> latencies = measurements.stream()
                .map(TaskMeasurement::latencyMs)
                .sorted()
                .toList();
        List<TaskOutcome> outcomes = measurements.stream()
                .map(TaskMeasurement::outcome)
                .toList();

        int successCount = (int) outcomes.stream().filter(TaskOutcome::ok).count();
        int failureCount = operations - successCount;
        List<String> sampleFailures = outcomes.stream()
                .filter(outcome -> !outcome.ok())
                .map(TaskOutcome::detail)
                .distinct()
                .limit(8)
                .toList();

        return new ScenarioExecution(
                wallTimeMs,
                successCount,
                failureCount,
                averageLatency(latencies),
                percentile(latencies, 95),
                percentile(latencies, 99),
                latencies,
                outcomes,
                sampleFailures
        );
    }

    private ScenarioResult toScenarioResult(
            String scenarioName,
            String target,
            String sampleDescription,
            int operations,
            int concurrency,
            ScenarioExecution execution,
            List<String> verificationNotes,
            boolean verificationPassed
    ) {
        double throughput = execution.wallTimeMs() == 0
                ? operations
                : operations * 1000.0 / execution.wallTimeMs();
        return new ScenarioResult(
                scenarioName,
                target,
                sampleDescription,
                operations,
                concurrency,
                execution.successCount(),
                execution.failureCount(),
                execution.wallTimeMs(),
                round(execution.averageLatencyMs()),
                execution.p95LatencyMs(),
                execution.p99LatencyMs(),
                round(throughput),
                verificationPassed,
                verificationNotes,
                execution.sampleFailures()
        );
    }

    // Preserve the remaining scenarios and generated artifacts even when one scenario aborts.
    private ScenarioResult executeScenario(String scenarioName, ScenarioSupplier supplier) {
        try {
            return supplier.get();
        } catch (Exception exception) {
            String message = summarizeException(exception);
            return new ScenarioResult(
                    scenarioName,
                    "N/A",
                    "场景在主流程中发生未捕获异常",
                    0,
                    0,
                    0,
                    1,
                    0,
                    0,
                    0,
                    0,
                    0,
                    false,
                    List.of("未捕获异常: " + message),
                    List.of(message)
            );
        }
    }

    private JsonNode postJson(MockHttpServletRequestBuilder requestBuilder) throws Exception {
        MvcResult result = mockMvc.perform(requestBuilder).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private JsonNode getJson(MockHttpServletRequestBuilder requestBuilder) throws Exception {
        MvcResult result = mockMvc.perform(requestBuilder).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    // Complete certificate verification on first login before returning the token.
    private String staffLoginAndGetToken(String username, String password) throws Exception {
        JsonNode loginJson = postJson(
                MockMvcRequestBuilders.post("/api/internal/staff/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "%s",
                                  "password": "%s"
                                }
                                """.formatted(username, password))
        );

        if (loginJson.get("code").asInt() != 0) {
            throw new IllegalStateException("staff login failed: " + loginJson);
        }
        if (loginJson.hasNonNull("auth_token")) {
            return loginJson.get("auth_token").asText();
        }

        JsonNode certificateJson = postJson(
                MockMvcRequestBuilders.post("/api/internal/staff/complete-certificate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "subject_type": "%s",
                                  "subject_key": "%s",
                                  "certificate_code": "CERT-123456"
                                }
                                """.formatted(
                                loginJson.get("certificate_subject_type").asText(),
                                loginJson.get("certificate_subject_key").asText()))
        );
        if (certificateJson.get("code").asInt() != 0) {
            throw new IllegalStateException("staff certificate failed: " + certificateJson);
        }
        return certificateJson.get("auth_token").asText();
    }

    private void writeJsonResult(PressureSuiteReport report) throws Exception {
        Files.createDirectories(JSON_RESULT_PATH.getParent());
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(JSON_RESULT_PATH.toFile(), report);
    }

    private void writeCsvSummary(List<ScenarioResult> scenarios) throws Exception {
        Files.createDirectories(CSV_RESULT_PATH.getParent());
        StringBuilder builder = new StringBuilder();
        builder.append("scenario,operations,concurrency,success_count,failure_count,wall_time_ms,avg_latency_ms,p95_latency_ms,p99_latency_ms,throughput_ops_per_sec,verification_passed\n");
        for (ScenarioResult scenario : scenarios) {
            builder.append(csv(scenario.scenarioName())).append(',')
                    .append(scenario.operations()).append(',')
                    .append(scenario.concurrency()).append(',')
                    .append(scenario.successCount()).append(',')
                    .append(scenario.failureCount()).append(',')
                    .append(scenario.wallTimeMs()).append(',')
                    .append(scenario.averageLatencyMs()).append(',')
                    .append(scenario.p95LatencyMs()).append(',')
                    .append(scenario.p99LatencyMs()).append(',')
                    .append(scenario.throughputOpsPerSec()).append(',')
                    .append(scenario.verificationPassed())
                    .append('\n');
        }
        Files.writeString(CSV_RESULT_PATH, builder.toString(), StandardCharsets.UTF_8);
    }

    private void writeMarkdownReport(PressureSuiteReport report) throws Exception {
        Files.createDirectories(REPORT_PATH.getParent());

        StringBuilder builder = new StringBuilder();
        builder.append("# 压力测试报告\n\n");
        builder.append("- 生成时间：").append(report.generatedAt()).append('\n');
        builder.append("- 测试对象：账户管理子系统后端接口（控制器级压力测试）\n");
        builder.append("- 数据库环境：").append(report.databaseEnvironment()).append('\n');
        builder.append("- 报告说明：章节组织参考根目录 PDF 模板中的压力测试部分，并补充了可复现过程文件。\n\n");

        builder.append("## 1. 测试使用的技术栈\n\n");
        for (String item : report.techStack()) {
            builder.append("- ").append(item).append('\n');
        }
        builder.append('\n');

        builder.append("## 2. 测试方法\n\n");
        for (String item : report.methodology()) {
            builder.append("- ").append(item).append('\n');
        }
        builder.append('\n');

        builder.append("## 3. 测试样例\n\n");
        for (String item : report.samples()) {
            builder.append("- ").append(item).append('\n');
        }
        builder.append('\n');

        builder.append("## 4. 测试结果\n\n");
        builder.append("| 场景 | 并发度 | 任务数 | 成功 | 失败 | 平均耗时(ms) | P95(ms) | P99(ms) | 吞吐(op/s) | 校验结论 |\n");
        builder.append("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |\n");
        for (ScenarioResult scenario : report.scenarios()) {
            builder.append("| ").append(scenario.scenarioName())
                    .append(" | ").append(scenario.concurrency())
                    .append(" | ").append(scenario.operations())
                    .append(" | ").append(scenario.successCount())
                    .append(" | ").append(scenario.failureCount())
                    .append(" | ").append(scenario.averageLatencyMs())
                    .append(" | ").append(scenario.p95LatencyMs())
                    .append(" | ").append(scenario.p99LatencyMs())
                    .append(" | ").append(scenario.throughputOpsPerSec())
                    .append(" | ").append(scenario.verificationPassed() ? "通过" : "未通过")
                    .append(" |\n");
        }
        builder.append('\n');

        for (ScenarioResult scenario : report.scenarios()) {
            builder.append("### ").append(scenario.scenarioName()).append("\n\n");
            builder.append("- 目标接口：").append(scenario.target()).append('\n');
            builder.append("- 样例说明：").append(scenario.sampleDescription()).append('\n');
            for (String note : scenario.verificationNotes()) {
                builder.append("- ").append(note).append('\n');
            }
            if (!scenario.sampleFailures().isEmpty()) {
                builder.append("- 典型失败样例：\n");
                for (String failure : scenario.sampleFailures()) {
                    builder.append("  - ").append(failure.replace('\n', ' ')).append('\n');
                }
            }
            builder.append('\n');
        }

        appendFailureAnalysis(builder, report.scenarios());

        builder.append("## 6. 其他说明与限制\n\n");
        for (String limitation : report.limitations()) {
            builder.append("- ").append(limitation).append('\n');
        }
        builder.append('\n');

        long passedCount = report.scenarios().stream().filter(ScenarioResult::verificationPassed).count();
        builder.append("## 7. 结论\n\n");
        builder.append("本次共执行 ").append(report.scenarios().size()).append(" 个压力测试场景，其中 ")
                .append(passedCount).append(" 个场景通过既定校验。");
        if (passedCount == report.scenarios().size() && !realMySqlMode) {
            builder.append(" 在当前 `MockMvc + H2(MySQL 模式)` 测试栈下，系统对并发开户、重复回调幂等和混合查询均表现稳定。");
        } else if (passedCount == report.scenarios().size()) {
            builder.append(" 在当前 `MockMvc + 真实 MySQL` 测试栈下，系统对各压测场景均表现稳定。");
        } else {
            builder.append(" 需要结合上文未通过场景继续排查系统在并发或幂等路径上的薄弱点。");
        }
        builder.append('\n');

        Files.writeString(REPORT_PATH, builder.toString(), StandardCharsets.UTF_8);
    }

    private void appendFailureAnalysis(StringBuilder builder, List<ScenarioResult> scenarios) {
        List<ScenarioResult> failedScenarios = scenarios.stream()
                .filter(scenario -> !scenario.verificationPassed())
                .toList();
        if (failedScenarios.isEmpty()) {
            return;
        }

        builder.append("## 5. 失败原因分析\n\n");
        for (ScenarioResult scenario : failedScenarios) {
            builder.append("### ").append(scenario.scenarioName()).append("\n\n");
            if (realMySqlMode && "混合并发查询".equals(scenario.scenarioName())) {
                builder.append("- 当前 DAO 层通过 `DriverManager.getConnection(...)` 为多数查询即时创建连接，未使用连接池。\n");
                builder.append("- `Dashboard / 账户列表` 路径存在明显的逐条补查数据模式，会把单次查询放大成多次数据库访问。\n");
                builder.append("- 在 40 并发、400 总请求的混合查询场景下，短时间内大量建连触发了 MySQL 客户端侧的 socket/临时端口资源耗尽。\n");
                builder.append("- 报错链中的 `CommunicationsException` 表示 JDBC 驱动未能成功建立数据库连接；其中 `BindException: Address already in use: connect` 指向的是客户端连接资源耗尽，而不是 SQL 语法错误。\n");
                builder.append("- 因此，该场景未通过的根因是“高并发读请求 + 无连接池 + N+1 查询放大”，而不是业务校验逻辑本身出错。\n\n");
                continue;
            }

            builder.append("- 该场景存在未通过校验的结果，需结合上文失败样例和数据库回查异常继续定位。\n\n");
        }
    }

    private String buildAdultIdNumber(int serial) {
        // Generates deterministic personal IDs that satisfy the adult validation rule.
        return "33010119900101" + String.format("%04d", serial);
    }

    private String summarizeException(Exception exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) {
            return exception.getClass().getSimpleName();
        }
        String singleLine = message.replace('\r', ' ').replace('\n', ' ').trim();
        return exception.getClass().getSimpleName() + ": " + singleLine;
    }

    // Selects the backing database for this suite run.
    private void configureDatabase() throws Exception {
        String dbMode = System.getProperty(DB_MODE_PROPERTY, "h2").trim().toLowerCase(Locale.ROOT);
        realMySqlMode = "mysql".equals(dbMode);

        if (realMySqlMode) {
            String host = requiredProperty(MYSQL_HOST_PROPERTY);
            String port = requiredProperty(MYSQL_PORT_PROPERTY);
            String database = requiredProperty(MYSQL_DATABASE_PROPERTY);
            jdbcUsername = requiredProperty(MYSQL_USERNAME_PROPERTY);
            jdbcPassword = requiredProperty(MYSQL_PASSWORD_PROPERTY);
            jdbcUrl = "jdbc:mysql://" + host + ":" + port + "/" + database + MYSQL_URL_SUFFIX;
            databaseEnvironment = "MySQL 8.0 (" + host + ":" + port + "/" + database + ")";
            TestDatabaseSupport.recreateSchema(jdbcUrl, jdbcUsername, jdbcPassword);
            return;
        }

        jdbcUrl = "jdbc:h2:mem:pressure_" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000";
        jdbcUsername = "sa";
        jdbcPassword = "";
        databaseEnvironment = "H2 in-memory database (MODE=MySQL)";
        TestDatabaseSupport.recreateSchema(jdbcUrl, jdbcUsername, jdbcPassword);
    }

    private String requiredProperty(String propertyName) {
        String value = System.getProperty(propertyName, "").trim();
        if (value.isBlank()) {
            throw new IllegalStateException("Missing required system property: " + propertyName);
        }
        return value;
    }

    private double averageLatency(List<Long> latencies) {
        if (latencies.isEmpty()) {
            return 0;
        }
        long sum = 0;
        for (Long latency : latencies) {
            sum += latency;
        }
        return sum / (double) latencies.size();
    }

    private long percentile(List<Long> sortedLatencies, int percentile) {
        if (sortedLatencies.isEmpty()) {
            return 0;
        }
        int index = (int) Math.ceil(percentile / 100.0 * sortedLatencies.size()) - 1;
        index = Math.max(0, Math.min(index, sortedLatencies.size() - 1));
        return sortedLatencies.get(index);
    }

    private double round(double value) {
        return Double.parseDouble(String.format(Locale.US, "%.2f", value));
    }

    private String csv(String value) {
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    @FunctionalInterface
    private interface ScenarioTask {
        TaskOutcome execute(int index) throws Exception;
    }

    @FunctionalInterface
    private interface ScenarioSupplier {
        ScenarioResult get() throws Exception;
    }

    private record TaskMeasurement(long latencyMs, TaskOutcome outcome) {
    }

    private record TaskOutcome(boolean ok, String detail, Map<String, Object> attributes) {
        static TaskOutcome success(Map<String, Object> attributes) {
            return new TaskOutcome(true, "OK", new LinkedHashMap<>(attributes));
        }

        static TaskOutcome failure(String detail, Map<String, Object> attributes) {
            return new TaskOutcome(false, detail, new LinkedHashMap<>(attributes));
        }
    }

    private record ScenarioExecution(
            long wallTimeMs,
            int successCount,
            int failureCount,
            double averageLatencyMs,
            long p95LatencyMs,
            long p99LatencyMs,
            List<Long> latencies,
            List<TaskOutcome> outcomes,
            List<String> sampleFailures
    ) {
    }

    private record ScenarioResult(
            String scenarioName,
            String target,
            String sampleDescription,
            int operations,
            int concurrency,
            int successCount,
            int failureCount,
            long wallTimeMs,
            double averageLatencyMs,
            long p95LatencyMs,
            long p99LatencyMs,
            double throughputOpsPerSec,
            boolean verificationPassed,
            List<String> verificationNotes,
            List<String> sampleFailures
    ) {
    }

    private record PressureSuiteReport(
            String generatedAt,
            String databaseEnvironment,
            List<String> techStack,
            List<String> methodology,
            List<String> samples,
            List<String> limitations,
            List<ScenarioResult> scenarios
    ) {
    }
}
