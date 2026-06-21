import { expect, Page, test } from "@playwright/test";
import { execFileSync } from "node:child_process";

const backendBase = "http://localhost:8080/api";
const mysqlExe = "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe";

type AdminSession = {
  authToken: string;
};

type SecurityListItem = {
  sec_acc_no: string;
  investor_id: number;
  name: string;
  id_number: string;
  investor_type: string;
  status: string;
  open_date: string;
  linked_fund_acc?: string | null;
};

type FundListItem = {
  fund_acc_no: string;
  sec_acc_no: string;
  name: string;
  id_number: string;
  available_balance: number;
  frozen_balance: number;
  currency: string;
  status: string;
  open_date: string;
};

async function clearBrowserSessions(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    const keys = [
      "stock_trading_token",
      "stock_trading_auth_token",
      "staff_username",
      "staff_id",
      "fund_acc_no",
      "sec_acc_no",
    ];

    for (const key of keys) {
      window.sessionStorage.removeItem(key);
      window.localStorage.removeItem(key);
    }
  });
}

function uniqueSuffix() {
  return `${Date.now()}`.slice(-6);
}

function queryRows(sql: string): string[][] {
  const output = execFileSync(
    mysqlExe,
    ["-uroot", "--password=MutsumiLZZ520!", "--default-character-set=utf8mb4", "-N", "-B", "-D", "account_db", "-e", sql],
    { encoding: "utf8" }
  ).trim();

  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split("\t"));
}

function querySingleRow(sql: string): string[] {
  const rows = queryRows(sql);
  if (rows.length === 0) {
    throw new Error(`SQL returned no rows: ${sql}`);
  }
  return rows[0];
}

async function adminApi<T>(path: string, authToken: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${backendBase}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Staff-Auth-Token": authToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json();
  if (!response.ok || json.code !== 0) {
    throw new Error(`Admin API failed: ${path} -> ${JSON.stringify(json)}`);
  }

  return (json.data ?? json) as T;
}

async function externalApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${backendBase}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json();
  if (!response.ok || json.code !== 0) {
    throw new Error(`External API failed: ${path} -> ${JSON.stringify(json)}`);
  }

  return (json.data ?? json) as T;
}

async function waitForDialog(page: Page) {
  const dialog = await page.waitForEvent("dialog");
  await dialog.accept();
}

async function loginAdmin(page: Page) {
  await clearBrowserSessions(page);
  await page.goto("/login");
  await page.getByTestId("login-mode-admin").click();
  await page.getByTestId("login-account").fill("staff01");
  await page.getByTestId("login-password").fill("staff01pass");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("header")).toContainText("staff01");
}

async function loginUser(page: Page, fundAccNo: string, password: string) {
  await clearBrowserSessions(page);
  await page.goto("/login");
  await page.getByTestId("login-mode-user").click();
  await page.getByTestId("login-account").fill(fundAccNo);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/user$/);
}

async function getAdminSession(page: Page): Promise<AdminSession> {
  const authToken = await page.evaluate(() => window.sessionStorage.getItem("stock_trading_token"));
  if (!authToken) {
    throw new Error("Admin session token missing in sessionStorage");
  }
  return { authToken };
}

test.describe("Full flow regression", () => {
  test("admin + user full flow with fund/holding freeze and reissue migration", async ({ page }) => {
    const suffix = uniqueSuffix();

    const personalName = `AutoPersonal${suffix}`;
    const personalId = "330101199405126517";
    const personalPhone = `1380000${suffix}`;

    const agentInvestorName = `AgentInvestor${suffix}`;
    const agentInvestorId = "330103199211083246";
    const agentName = `Proxy${suffix}`;
    const agentId = "330102199307164512";

    const corpName = `Corp${suffix}`;
    const corpLicense = `CORP-${suffix}-01`;
    const corpReg = `REG-${suffix}`;
    const corpBiz = `BIZ-${suffix}`;
    const corpAgentId = "330104198907224839";

    await loginAdmin(page);
    const admin = await getAdminSession(page);

    await page.goto("/securities");

    {
      const dialogPromise = waitForDialog(page);
      await page.getByTestId("open-security-create").click();
      await page.locator("#person-name").fill(personalName);
      await page.locator("#person-id-number").fill(personalId);
      await page.locator("#person-phone").fill(personalPhone);
      await page.locator("#person-work-unit").fill("Auto Unit");
      await page.locator("#person-address").fill("Auto Address");
      await page.locator("#person-occupation").fill("Engineer");
      await page.locator("#person-education").fill("Bachelor");
      await page.getByTestId("security-create-submit").click();
      await dialogPromise;
      await expect(page.getByText(personalName)).toBeVisible();
    }

    {
      const dialogPromise = waitForDialog(page);
      await page.getByTestId("open-security-create").click();
      await page.getByTestId("security-attendance-agent").click();
      await page.locator("#person-name").fill(agentInvestorName);
      await page.locator("#person-id-number").fill(agentInvestorId);
      await page.locator("#person-phone").fill(`1390000${suffix}`);
      await page.locator("#person-work-unit").fill("Agent Unit");
      await page.locator("#person-address").fill("Agent Address");
      await page.locator("#person-occupation").fill("Teacher");
      await page.locator("#person-education").fill("Master");
      await page.locator("#person-agent-name").fill(agentName);
      await page.locator("#person-agent-id-number").fill(agentId);
      await page.getByTestId("security-create-submit").click();
      await dialogPromise;
      await expect(page.getByText(agentInvestorName)).toBeVisible();
    }

    {
      const dialogPromise = waitForDialog(page);
      await page.getByTestId("open-security-create").click();
      await page.getByTestId("security-tab-corporate").click();
      await page.locator("#corp-name").fill(corpName);
      await page.locator("#corp-id-number").fill(corpLicense);
      await page.locator("#corp-legal-number").fill(corpReg);
      await page.locator("#corp-business-license").fill(corpBiz);
      await page.locator("#corp-phone").fill(`0571${suffix.slice(-4)}`);
      await page.locator("#corp-address").fill("Corp Address");
      await page.locator("#corp-authorize-name").fill(`Auth${suffix}`);
      await page.locator("#corp-authorize-phone").fill(`1370000${suffix}`);
      await page.locator("#corp-authorize-address").fill("Auth Address");
      await page.locator("#corp-executor-name").fill(`Exec${suffix}`);
      await page.locator("#corp-agent-name").fill(`CorpAgent${suffix}`);
      await page.locator("#corp-agent-id-number").fill(corpAgentId);
      await page.getByTestId("security-create-submit").click();
      await dialogPromise;
      await expect(page.getByText(corpName)).toBeVisible();
    }

    const securityList = await adminApi<SecurityListItem[]>("/internal/security/accounts", admin.authToken);
    const personalSecurity = securityList.find((item) => item.name === personalName);
    const agentSecurity = securityList.find((item) => item.name === agentInvestorName);
    const corporateSecurity = securityList.find((item) => item.name === corpName);

    expect(personalSecurity).toBeTruthy();
    expect(agentSecurity).toBeTruthy();
    expect(corporateSecurity).toBeTruthy();
    expect(agentSecurity?.investor_type).toBe("个人");
    expect(corporateSecurity?.investor_type).toBe("法人");

    const agentInvestorRow = querySingleRow(
      `SELECT agent_name, agent_id_number FROM investor WHERE investor_id=${agentSecurity!.investor_id}`
    );
    expect(agentInvestorRow[0]).toBe(agentName);
    expect(agentInvestorRow[1]).toBe(agentId);

    await page.goto("/funds");

    {
      const dialogPromise = waitForDialog(page);
      await page.getByTestId("open-fund-create").click();
      await page.locator("#fund-sec-acc-no").fill(personalSecurity!.sec_acc_no);
      await page.locator("#fund-id-number").fill(personalId);
      await page.locator("#fund-trade-password").fill("123456");
      await page.locator("#fund-withdraw-password").fill("654321");
      await page.getByTestId("fund-create-submit").click();
      await dialogPromise;
      await expect(page.getByText(personalName)).toBeVisible();
    }

    const fundList = await adminApi<FundListItem[]>("/internal/fund/accounts/list", admin.authToken);
    const personalFund = fundList.find((item) => item.name === personalName && item.status === "normal");
    expect(personalFund).toBeTruthy();

    await adminApi("/internal/fund/deposit", admin.authToken, "POST", {
      fund_acc_no: personalFund!.fund_acc_no,
      amount: 1000,
    });

    const orderId = `ORD-BUY-${suffix}`;

    await externalApi("/external/trade/security-holding", "POST", {
      sec_acc_no: personalSecurity!.sec_acc_no,
      stock_code: "600519",
      stock_name: "贵州茅台",
      ref_order_id: orderId,
      change_type: "买入增加",
      quantity: 20,
      price: 100,
    });

    await externalApi("/external/trade/fund-balance", "POST", {
      fund_acc_no: personalFund!.fund_acc_no,
      ref_order_id: orderId,
      txn_type: "买入冻结",
      amount: 300,
    });

    await page.reload();
    await expect(page.getByTestId(`fund-row-${personalFund!.fund_acc_no}`)).toBeVisible();

    await page.getByTestId(`fund-logs-${personalFund!.fund_acc_no}`).click();
    await expect(page.locator('[role="dialog"] table')).toBeVisible();
    await expect(page.locator('[role="dialog"] table')).toContainText("600519");
    await expect(page.locator('[role="dialog"] table')).toContainText("贵州茅台");
    await page.keyboard.press("Escape");

    {
      await page.getByTestId(`fund-loss-${personalFund!.fund_acc_no}`).click();
      const dialog = page.locator('[role="dialog"]').last();
      await dialog.locator('input').nth(0).fill(personalId);
      await dialog.locator('input').nth(1).fill(personalSecurity!.sec_acc_no);
      await dialog.locator('input').nth(2).fill("lost");
      await page.getByTestId("fund-account-action-submit").click();
      await expect(dialog).toBeHidden();
    }

    const frozenFundInfo = await adminApi<any>(
      `/internal/fund/accounts?fund_acc_no=${encodeURIComponent(personalFund!.fund_acc_no)}&id_number=${encodeURIComponent(personalId)}&include_logs=true`,
      admin.authToken
    );
    expect(Number(frozenFundInfo.available_balance)).toBe(0);
    expect(Number(frozenFundInfo.frozen_balance)).toBe(1000);
    expect(frozenFundInfo.status).toBe("FROZEN_LOSS");

    const securityAfterLoss = await adminApi<SecurityListItem[]>("/internal/security/accounts", admin.authToken);
    const personalSecurityFrozen = securityAfterLoss.find((item) => item.sec_acc_no === personalSecurity!.sec_acc_no);
    expect(personalSecurityFrozen?.status).toBe("frozen");

    const holdingAfterFreeze = querySingleRow(
      `SELECT quantity, frozen_quantity, stock_code, stock_name FROM holding WHERE sec_acc_no='${personalSecurity!.sec_acc_no}' AND stock_code='600519'`
    );
    expect(Number(holdingAfterFreeze[0])).toBe(0);
    expect(Number(holdingAfterFreeze[1])).toBe(20);
    expect(holdingAfterFreeze[2]).toBe("600519");
    expect(holdingAfterFreeze[3]).toBe("贵州茅台");

    {
      await page.getByTestId(`fund-reissue-${personalFund!.fund_acc_no}`).click();
      const dialog = page.locator('[role="dialog"]').last();
      await dialog.locator('input').nth(0).fill(personalId);
      await dialog.locator('input').nth(1).fill(personalSecurity!.sec_acc_no);
      await dialog.locator('input').nth(2).fill("111111");
      await dialog.locator('input').nth(3).fill("222222");
      await page.getByTestId("fund-account-action-submit").click();
      await expect(dialog).toBeHidden();
    }

    const updatedFundList = await adminApi<FundListItem[]>("/internal/fund/accounts/list", admin.authToken);
    const oldFundClosed = updatedFundList.find((item) => item.fund_acc_no === personalFund!.fund_acc_no);
    const reissuedFund = updatedFundList.find(
      (item) => item.name === personalName && item.status === "normal" && item.fund_acc_no !== personalFund!.fund_acc_no
    );

    expect(oldFundClosed?.status).toBe("closed");
    expect(Number(oldFundClosed?.available_balance ?? 0)).toBe(0);
    expect(Number(oldFundClosed?.frozen_balance ?? 0)).toBe(0);
    expect(reissuedFund).toBeTruthy();
    expect(Number(reissuedFund?.available_balance ?? 0)).toBe(1000);
    expect(Number(reissuedFund?.frozen_balance ?? 0)).toBe(0);

    const securityAfterReissue = await adminApi<SecurityListItem[]>("/internal/security/accounts", admin.authToken);
    const reboundSecurity = securityAfterReissue.find((item) => item.sec_acc_no === personalSecurity!.sec_acc_no);
    expect(reboundSecurity).toBeTruthy();
    expect(reboundSecurity?.status).toBe("normal");
    expect(reboundSecurity?.linked_fund_acc).toBe(reissuedFund!.fund_acc_no);

    const holdingAfterReissue = querySingleRow(
      `SELECT quantity, frozen_quantity, stock_code, stock_name FROM holding WHERE sec_acc_no='${personalSecurity!.sec_acc_no}' AND stock_code='600519'`
    );
    expect(Number(holdingAfterReissue[0])).toBe(20);
    expect(Number(holdingAfterReissue[1])).toBe(0);
    expect(holdingAfterReissue[2]).toBe("600519");
    expect(holdingAfterReissue[3]).toBe("贵州茅台");

    const oldFundDb = querySingleRow(
      `SELECT status, available_balance, frozen_balance FROM fund_account WHERE fund_acc_no='${personalFund!.fund_acc_no}'`
    );
    expect(oldFundDb[0]).toBe("已销户");
    expect(Number(oldFundDb[1])).toBe(0);
    expect(Number(oldFundDb[2])).toBe(0);

    const userLoginResponse = await externalApi<any>("/external/fund/login", "POST", {
      fund_acc_no: reissuedFund!.fund_acc_no,
      trade_password: "111111",
    });
    expect(userLoginResponse.auth_token).toBeTruthy();

    await loginUser(page, reissuedFund!.fund_acc_no, "111111");
    await expect(page.locator("body")).toContainText("600519");
    await expect(page.locator("body")).toContainText("贵州茅台");
    await expect(page.locator("body")).toContainText("1,000.00");
    await expect(page.locator("body")).toContainText("0.00");

    await page.goto("/user/password");
    await page.locator("#oldPassword").fill("111111");
    await page.locator("#newPassword").fill("333333");
    await page.locator("#confirmPassword").fill("333333");
    await page.getByRole("button").filter({ hasText: "确认" }).last().click();
    await expect(page.locator("body")).toContainText("成功");

    await loginAdmin(page);
    const adminAfterRelogin = await getAdminSession(page);

    const recentLogs = await adminApi<any[]>("/internal/dashboard/recent-logs?limit=20", adminAfterRelogin.authToken);
    const relatedLogs = recentLogs.filter(
      (item) =>
        item.fund_acc_no === reissuedFund!.fund_acc_no ||
        item.fund_acc_no === personalFund!.fund_acc_no ||
        item.security_acc_no === reboundSecurity!.sec_acc_no ||
        item.target_id === reissuedFund!.fund_acc_no
    );
    expect(relatedLogs.length).toBeGreaterThan(0);
    expect(page.locator("main")).toContainText(reissuedFund!.fund_acc_no);
  });
});
