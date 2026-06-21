package account.integration;

import account.common.AuthHeaders;
import account.controller.external.AdminController;
import account.controller.external.AuditController;
import account.controller.external.ExternalFundController;
import account.controller.external.ExternalSecurityController;
import account.controller.external.ExternalTradeController;
import account.controller.internal.FundAccountController;
import account.controller.internal.SecurityAccountController;
import account.controller.internal.StaffController;
import account.dao.DaoRegistry;
import account.exception.GlobalExceptionHandler;
import account.service.AdminServiceImpl;
import account.service.AuditServiceImpl;
import account.service.FundAccountServiceImpl;
import account.service.InMemoryClientAuthTokenService;
import account.service.InMemoryStaffAuthTokenService;
import account.service.OperationLogViewMapper;
import account.service.PasswordUtil;
import account.service.SecurityAccountServiceImpl;
import account.service.StaffServiceImpl;
import account.service.api.AdminService;
import account.service.api.AuditService;
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
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 账户业务子系统的安全/加固测试。
 *
 * <p>分两类：
 * <ul>
 *   <li><b>防护型测试</b>（预期通过）：证明系统已经正确防御 SQL 注入、XSS 输出、
 *       横向越权、令牌篡改、密码哈希存储等。</li>
 *   <li><b>漏洞固化测试</b>（预期通过但记录问题）：把审计发现的弱点用断言固化，
 *       一旦后端修复了，断言失败，开发就能感知到。</li>
 * </ul>
 */
class SecurityHardeningTest {

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;
    private DaoRegistry registry;
    private String jdbcUrl;

    // 投资者 A
    private static final String ID_A = "330101199001010031";
    private String secA;
    private String fundA;
    private String tokenA;

    // 投资者 B
    private static final String ID_B = "330101199203030014";
    private String secB;
    private String fundB;
    private String tokenB;

    private String staffToken;

    @BeforeEach
    void setUp() throws Exception {
        jdbcUrl = "jdbc:h2:mem:sec_" + UUID.randomUUID()
                + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1";
        TestDatabaseSupport.recreateSchema(jdbcUrl);
        registry = DaoRegistry.forDriverManager(jdbcUrl, "sa", "");
        TestDatabaseSupport.insertStaff(jdbcUrl, 1, "staff01", "staff-pass", "正常");

        objectMapper = new ObjectMapper().findAndRegisterModules();
        StaffAuthTokenService staffAuthTokenService = new InMemoryStaffAuthTokenService(28800L);
        ClientAuthTokenService clientAuthTokenService = new InMemoryClientAuthTokenService(7200L);
        // 黑名单服务在测试里默认全部放行
        account.integration.BlacklistClient blacklistClient = userName -> false;

        StaffService staffService = new StaffServiceImpl(registry, staffAuthTokenService);
        FundAccountService fundService = new FundAccountServiceImpl(registry, blacklistClient, clientAuthTokenService);
        SecurityAccountService securityService = new SecurityAccountServiceImpl(registry, blacklistClient, clientAuthTokenService);
        AdminService adminService = new AdminServiceImpl(registry);
        AuditService auditService = new AuditServiceImpl(registry, new OperationLogViewMapper(registry));

        mockMvc = MockMvcBuilders.standaloneSetup(
                        new StaffController(staffService, staffAuthTokenService, objectMapper),
                        new SecurityAccountController(securityService, staffAuthTokenService, objectMapper),
                        new FundAccountController(fundService, staffAuthTokenService, objectMapper),
                        new ExternalFundController(fundService, objectMapper),
                        new ExternalSecurityController(securityService, objectMapper),
                        new ExternalTradeController(fundService, securityService, objectMapper),
                        new AdminController(adminService, staffAuthTokenService, objectMapper),
                        new AuditController(auditService, staffAuthTokenService, objectMapper)
                )
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        staffToken = staffLogin("staff01", "staff-pass");
        Accounts a = openInvestor("Alice", ID_A, "trade-a", "withdraw-a");
        secA = a.secAccNo;
        fundA = a.fundAccNo;
        tokenA = clientLogin(fundA, "trade-a");

        Accounts b = openInvestor("Bob",   ID_B, "trade-b", "withdraw-b");
        secB = b.secAccNo;
        fundB = b.fundAccNo;
        tokenB = clientLogin(fundB, "trade-b");
    }

    // ---------------------------------------------------------------------
    // 防护型测试
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("SQL 注入：登录字段含注入载荷会被参数化处理，返回业务错误而不是 5xx 或绕过校验")
    void sqlInjection_loginPayloadIsParameterized() throws Exception {
        String[] payloads = {
                "FA0001' OR '1'='1",
                "FA0001\"; DROP TABLE staff;--",
                "FA0001' UNION SELECT password_hash FROM staff --",
                "FA0001' /* */ OR /**/ 1=1 --"
        };
        for (String payload : payloads) {
            MvcResult res = mockMvc.perform(post("/api/external/fund/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"fund_acc_no\":\"" + payload.replace("\"", "\\\"")
                                    + "\",\"trade_password\":\"x\"}"))
                    .andExpect(status().isOk())
                    .andReturn();
            JsonNode body = readJson(res);
            // 必须落到业务错误（账户不存在），且没有抛 SQL 异常
            assertNotEquals(0, body.get("code").asInt(),
                    "登录不能成功，否则可能是 SQL 注入绕过：payload=" + payload);
            assertFalse(body.get("message").asText().toLowerCase().contains("syntax"),
                    "错误信息不能包含 SQL 语法异常：payload=" + payload);
        }

        // 表必须仍然存在：再用合法账户走一次登录
        String t = clientLogin(fundA, "trade-a");
        assertNotNull(t, "staff 表/fund_account 表应当没有被 DROP");
    }

    @Test
    @DisplayName("SQL 注入：路径/查询参数中的注入载荷被参数化处理，资金快照不会泄露其它账户")
    void sqlInjection_queryParameterIsParameterized() throws Exception {
        String payload = fundA + "' OR '1'='1";
        MvcResult res = mockMvc.perform(get("/api/external/fund/snapshot")
                        .param("fund_acc_no", payload)
                        .param("auth_token", tokenA))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = readJson(res);
        assertNotEquals(0, body.get("code").asInt(),
                "注入载荷必须落到业务错误，不能命中真实账户");
    }

    @Test
    @DisplayName("XSS：开户姓名携带 <script> 时，响应是 JSON 文本（escape 后存储），Content-Type 永远是 application/json")
    void xss_responseContentTypeAndJsonEscape() throws Exception {
        String name = "<script>alert(1)</script>";
        MvcResult res = mockMvc.perform(post("/api/internal/security/accounts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(AuthHeaders.STAFF_AUTH_TOKEN, staffToken)
                        .content("{"
                                + "\"investor_type\":\"个人\","
                                + "\"name\":\"" + name + "\","
                                + "\"gender\":\"男\","
                                + "\"id_type\":\"ID\","
                                + "\"id_number\":\"330101199404040051\","
                                + "\"phone\":\"13800000099\","
                                + "\"address\":\"X\""
                                + "}"))
                .andExpect(status().isOk())
                .andReturn();
        String ct = res.getResponse().getContentType();
        assertNotNull(ct);
        assertTrue(ct.toLowerCase().contains("application/json"),
                "响应必须是 application/json，避免浏览器解释为 HTML：" + ct);
        // 原始 <script> 在 JSON 中按字符出现是允许的；XSS 风险靠浏览器侧 JSON 解析
        // 但响应不能是 text/html
        assertFalse(ct.toLowerCase().contains("text/html"),
                "响应不能是 text/html，否则前端按 HTML 渲染时会执行脚本");
    }

    @Test
    @DisplayName("横向越权：A 持有的 auth_token 不能查询 B 的资金快照")
    void idor_clientCannotAccessOtherFundSnapshot() throws Exception {
        MvcResult res = mockMvc.perform(get("/api/external/fund/snapshot")
                        .param("fund_acc_no", fundB)
                        .param("auth_token", tokenA))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = readJson(res);
        assertEquals(1018, body.get("code").asInt(),
                "A 的 token 查询 B 的快照必须被拒绝（ERR_018）。实际：" + body);
    }

    @Test
    @DisplayName("横向越权：A 持有的 auth_token 不能查询 B 的持仓")
    void idor_clientCannotAccessOtherSecuritySnapshot() throws Exception {
        MvcResult res = mockMvc.perform(get("/api/external/security/snapshot")
                        .param("sec_acc_no", secB)
                        .param("auth_token", tokenA))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = readJson(res);
        assertEquals(1018, body.get("code").asInt(),
                "A 的 token 查询 B 的持仓必须被拒绝（ERR_018）");
    }

    @Test
    @DisplayName("横向越权：A 持有的 auth_token 不能修改 B 的资金密码")
    void idor_clientCannotChangeOtherFundPassword() throws Exception {
        MvcResult res = mockMvc.perform(put("/api/external/fund/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{"
                                + "\"fund_acc_no\":\"" + fundB + "\","
                                + "\"auth_token\":\"" + tokenA + "\","
                                + "\"password_type\":\"trade\","
                                + "\"old_password\":\"trade-b\","
                                + "\"new_password\":\"hacked\""
                                + "}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = readJson(res);
        assertEquals(1018, body.get("code").asInt(),
                "A 的 token 修改 B 的密码必须被拒绝（ERR_018）");

        // 反向验证：B 仍然可以用原密码登录
        String t = clientLogin(fundB, "trade-b");
        assertNotNull(t, "B 的密码必须未被改动");
    }

    @Test
    @DisplayName("Token 篡改：随便构造一个 token 不能拿到任何数据")
    void tampered_clientTokenIsRejected() throws Exception {
        String fakeToken = "f".repeat(64);
        MvcResult res = mockMvc.perform(get("/api/external/fund/snapshot")
                        .param("fund_acc_no", fundA)
                        .param("auth_token", fakeToken))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals(1018, readJson(res).get("code").asInt());
    }

    @Test
    @DisplayName("Token 长度：客户端 token 是 32 字节随机数（64 个 hex 字符），具有足够熵")
    void clientTokenHasSufficientEntropy() {
        assertNotNull(tokenA);
        assertEquals(64, tokenA.length(),
                "auth_token 长度异常，可能熵不足：" + tokenA);
        assertTrue(tokenA.matches("[0-9a-f]+"), "auth_token 必须为 hex");
        assertNotEquals(tokenA, tokenB, "两次签发的 token 不能相同");
    }

    @Test
    @DisplayName("Staff Token 失效：停用工作人员后，其旧 token 立即失效")
    void deactivatedStaffTokenIsImmediatelyRevoked() throws Exception {
        // 新开一个 staff，让 staff01 把他停用，确认旧 token 立刻不能用
        TestDatabaseSupport.insertStaff(jdbcUrl, 2, "staff02", "staff-pass", "正常");
        String victimToken = staffLogin("staff02", "staff-pass");

        mockMvc.perform(post("/api/internal/staff/deactivate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(AuthHeaders.STAFF_AUTH_TOKEN, staffToken)
                        .content("{\"target_staff_id\":2,\"reason\":\"left\"}"))
                .andExpect(status().isOk());

        MvcResult res = mockMvc.perform(get("/api/internal/fund/accounts/list")
                        .header(AuthHeaders.STAFF_AUTH_TOKEN, victimToken))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals(1018, readJson(res).get("code").asInt(),
                "被停用员工的旧 token 必须立即失效");
    }

    @Test
    @DisplayName("[VULN] 缺失 X-Staff-Auth-Token 时返回 500（而非 400），且消息把内部异常描述暴露给客户端")
    void vuln_missingStaffAuthTokenReturnsServerError() throws Exception {
        MvcResult res = mockMvc.perform(get("/api/internal/fund/accounts/list"))
                .andExpect(status().isInternalServerError())
                .andReturn();
        String body = res.getResponse().getContentAsString(StandardCharsets.UTF_8);
        // 当前实现把 MissingRequestHeaderException.getMessage() 拼进了返回体，等于把异常类型/参数名等内部细节回显给客户端
        // 修复方向：在 GlobalExceptionHandler 加 MissingRequestHeaderException -> ERR_018 的 mapping
        assertTrue(body.toLowerCase().contains("missing") || body.contains("X-Staff"),
                "VULN: 当前响应把内部异常信息暴露给客户端：" + body);
        // 反向断言：不能包含完整 .java 文件名或 stacktrace 关键字（确认至少没把完整栈打出去）
        assertFalse(body.contains(".java"),
                "至少不能在响应里出现 .java 文件名: " + body);
        assertFalse(body.toLowerCase().contains("stacktrace"),
                "至少不能出现 stacktrace 字面量: " + body);
    }

    @Test
    @DisplayName("密码哈希：数据库里存放的是 SHA-256 哈希（64 hex），绝对不是明文")
    void passwordIsStoredAsHash() throws Exception {
        try (java.sql.Connection conn = java.sql.DriverManager.getConnection(jdbcUrl, "sa", "");
             java.sql.Statement st = conn.createStatement();
             java.sql.ResultSet rs = st.executeQuery(
                     "select trade_password, withdraw_password from fund_account where fund_acc_no='" + fundA + "'")) {
            assertTrue(rs.next(), "应当能读到 fundA 的密码哈希行");
            String tradeStored = rs.getString(1);
            String withdrawStored = rs.getString(2);

            assertNotEquals("trade-a", tradeStored, "trade_password 必须哈希存储，绝不能是明文！");
            assertNotEquals("withdraw-a", withdrawStored, "withdraw_password 必须哈希存储");
            assertEquals(64, tradeStored.length(), "trade_password 必须是 SHA-256 hex（64 字符）");
            assertEquals(PasswordUtil.hash("trade-a"), tradeStored,
                    "存储值必须与 PasswordUtil.hash(明文) 完全一致");
        }
    }

    @Test
    @DisplayName("取款密码错误时，不允许扣款，也不在响应里回显余额")
    void wrongWithdrawPasswordDoesNotLeakBalance() throws Exception {
        // 先存点钱进去
        mockMvc.perform(post("/api/internal/fund/deposit")
                .contentType(MediaType.APPLICATION_JSON)
                .header(AuthHeaders.STAFF_AUTH_TOKEN, staffToken)
                .content("{\"fund_acc_no\":\"" + fundA + "\",\"amount\":1000.00}"))
                .andExpect(status().isOk());

        MvcResult res = mockMvc.perform(post("/api/internal/fund/withdraw")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(AuthHeaders.STAFF_AUTH_TOKEN, staffToken)
                        .content("{\"fund_acc_no\":\"" + fundA
                                + "\",\"amount\":10.00,\"withdraw_password\":\"WRONG\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = readJson(res);
        assertEquals(1004, body.get("code").asInt(), "应当返回 ERR_004 密码错误");
        assertNull(body.get("available_balance"),
                "错误响应里不应当回显 available_balance 字段");
    }

    // ---------------------------------------------------------------------
    // 漏洞固化测试（断言记录当前实现的弱点）
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("[VULN] 交易回调接口完全无认证：任何人都能改任意账户的资金余额")
    void vuln_unauthenticatedTradeCallbackCanMutateBalances() throws Exception {
        // 这里不带任何 token / header
        MvcResult res = mockMvc.perform(post("/api/external/trade/fund-balance")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{"
                                + "\"fund_acc_no\":\"" + fundA + "\","
                                + "\"ref_order_id\":\"PWN-001\","
                                + "\"txn_type\":\"卖出回款\","
                                + "\"amount\":99999.00"
                                + "}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = readJson(res);
        // 漏洞固化：当前实现允许这种调用
        assertEquals(0, body.get("code").asInt(),
                "VULN: 当前实现允许无认证的资金回调。修复后请改为非 0。");
        assertTrue(body.has("available_balance"));
    }

    @Test
    @DisplayName("[VULN] 登录错误信息区分账户存在与否：用户枚举漏洞")
    void vuln_loginErrorAllowsAccountEnumeration() throws Exception {
        MvcResult notExist = mockMvc.perform(post("/api/external/fund/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fund_acc_no\":\"FA0000DOESNOTEXIST\",\"trade_password\":\"x\"}"))
                .andReturn();
        MvcResult wrongPwd = mockMvc.perform(post("/api/external/fund/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fund_acc_no\":\"" + fundA + "\",\"trade_password\":\"WRONG\"}"))
                .andReturn();
        int codeNotExist = readJson(notExist).get("code").asInt();
        int codeWrongPwd = readJson(wrongPwd).get("code").asInt();
        // 漏洞固化：两条错误码不同——攻击者能枚举资金账户号
        assertNotEquals(codeNotExist, codeWrongPwd,
                "VULN: 当前实现登录失败的错误码分别是 ERR_010 / ERR_004，可被用于用户枚举。"
                        + " 修复后应统一为同一错误码 ERR_004。");
        assertEquals(1010, codeNotExist, "账户不存在返回 ERR_010");
        assertEquals(1004, codeWrongPwd, "密码错误返回 ERR_004");
    }

    @Test
    @DisplayName("[VULN] 普通柜员凭 staff token 即可调用 /api/admin 系列管理员接口（无 RBAC）")
    void vuln_anyStaffTokenCanCallAdminEndpoints() throws Exception {
        MvcResult res = mockMvc.perform(post("/api/admin/fund/settle-annual-interest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(AuthHeaders.STAFF_AUTH_TOKEN, staffToken)
                        .content("{\"year_rate\":\"0.0350\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = readJson(res);
        // 不能是认证错误：当前实现没有 RBAC，所以业务码是 0
        assertNotEquals(1018, body.get("code").asInt(),
                "VULN: 当前没有 RBAC——任何 staff token 都能跑年化结息这种本应只允许管理员的操作。");
    }

    @Test
    @DisplayName("[VULN] 普通柜员凭 staff token 即可读取所有账户的姓名+身份证号（个人信息批量泄露）")
    void vuln_listAllAccountsLeaksPii() throws Exception {
        MvcResult res = mockMvc.perform(get("/api/internal/fund/accounts/list")
                        .header(AuthHeaders.STAFF_AUTH_TOKEN, staffToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = readJson(res);
        assertEquals(0, body.get("code").asInt());
        boolean foundPii = false;
        for (JsonNode item : body.get("data")) {
            if (ID_A.equals(item.path("id_number").asText())
                    || ID_B.equals(item.path("id_number").asText())) {
                foundPii = true;
                break;
            }
        }
        assertTrue(foundPii,
                "VULN: 列表接口当前回显完整身份证号。修复后应当脱敏或按权限收敛。");
    }

    @Test
    @DisplayName("[VULN] 投资者 auth_token 通过 URL 查询参数传递（容易写入 access log / Referer）")
    void vuln_authTokenIsCarriedInQueryString() throws Exception {
        // 检查代码：snapshot 接口接受 ?auth_token=...，而不是放在 Header
        MvcResult res = mockMvc.perform(get("/api/external/fund/snapshot")
                        .param("fund_acc_no", fundA)
                        .param("auth_token", tokenA))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals(0, readJson(res).get("code").asInt());
        // 此处用断言固化"接口被设计为接受 query 参数中的 token"这一弱点
    }

    // ---------------------------------------------------------------------
    // 工具方法
    // ---------------------------------------------------------------------

    private String staffLogin(String username, String password) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/internal/staff/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = readJson(res);
        assertEquals(0, body.get("code").asInt());
        if (body.hasNonNull("auth_token")) {
            return body.get("auth_token").asText();
        }

        assertTrue(body.get("requires_certificate").asBoolean());
        MvcResult certificate = mockMvc.perform(post("/api/internal/staff/complete-certificate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{"
                                + "\"subject_type\":\"" + body.get("certificate_subject_type").asText() + "\","
                                + "\"subject_key\":\"" + body.get("certificate_subject_key").asText() + "\","
                                + "\"certificate_code\":\"CERT-123456\""
                                + "}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode certificateBody = readJson(certificate);
        assertEquals(0, certificateBody.get("code").asInt());
        return certificateBody.get("auth_token").asText();
    }

    private String clientLogin(String fundAccNo, String tradePwd) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/external/fund/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fund_acc_no\":\"" + fundAccNo + "\",\"trade_password\":\"" + tradePwd + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = readJson(res);
        if (body.get("code").asInt() != 0) {
            return null;
        }
        if (body.hasNonNull("auth_token")) {
            return body.get("auth_token").asText();
        }

        assertTrue(body.get("requires_certificate").asBoolean());
        MvcResult certificate = mockMvc.perform(post("/api/external/fund/complete-certificate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{"
                                + "\"subject_type\":\"" + body.get("certificate_subject_type").asText() + "\","
                                + "\"subject_key\":\"" + body.get("certificate_subject_key").asText() + "\","
                                + "\"certificate_code\":\"CERT-123456\""
                                + "}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode certificateBody = readJson(certificate);
        assertEquals(0, certificateBody.get("code").asInt());
        return certificateBody.get("auth_token").asText();
    }

    private Accounts openInvestor(String name, String idNumber, String tradePwd, String withdrawPwd) throws Exception {
        MvcResult sec = mockMvc.perform(post("/api/internal/security/accounts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(AuthHeaders.STAFF_AUTH_TOKEN, staffToken)
                        .content("{"
                                + "\"investor_type\":\"个人\","
                                + "\"name\":\"" + name + "\","
                                + "\"gender\":\"男\","
                                + "\"id_type\":\"ID\","
                                + "\"id_number\":\"" + idNumber + "\","
                                + "\"phone\":\"13800000000\","
                                + "\"address\":\"Hangzhou\","
                                + "\"work_unit\":\"ZJU\","
                                + "\"occupation\":\"Engineer\","
                                + "\"education\":\"Bachelor\""
                                + "}"))
                .andExpect(status().isOk())
                .andReturn();
        String secAccNo = readJson(sec).get("sec_acc_no").asText();

        MvcResult fund = mockMvc.perform(post("/api/internal/fund/accounts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(AuthHeaders.STAFF_AUTH_TOKEN, staffToken)
                        .content("{"
                                + "\"sec_acc_no\":\"" + secAccNo + "\","
                                + "\"id_number\":\"" + idNumber + "\","
                                + "\"trade_password\":\"" + tradePwd + "\","
                                + "\"withdraw_password\":\"" + withdrawPwd + "\","
                                + "\"currency\":\"CNY\""
                                + "}"))
                .andExpect(status().isOk())
                .andReturn();
        String fundAccNo = readJson(fund).get("fund_acc_no").asText();
        return new Accounts(secAccNo, fundAccNo);
    }

    private JsonNode readJson(MvcResult res) throws Exception {
        return objectMapper.readTree(res.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private record Accounts(String secAccNo, String fundAccNo) {}
}
