package com.zju.account.service;

import com.zju.account.dto.request.*;

/**
 * 资金账户业务 Service 接口。
 * 实现类尚未完整就绪——Controller 在调用前会捕获 {@link UnsupportedOperationException} 走 Mock 数据兜底。
 */
public interface FundAccountService {

    /** 交易客户端登录鉴权（外部接口 clientLoginAuth）。 */
    default Object clientLoginAuth(String fundAccNo, String tradePassword) {
        throw new UnsupportedOperationException("clientLoginAuth not implemented yet");
    }

    /** 查询资金账户快照（外部接口 getFundSnapshot）。 */
    default Object getFundSnapshot(String fundAccNo) {
        throw new UnsupportedOperationException("getFundSnapshot not implemented yet");
    }

    /** 修改交易/取款密码（外部接口 clientChangeFundPassword）。 */
    default Object clientChangeFundPassword(ClientChangeFundPasswordRequest request) {
        throw new UnsupportedOperationException("clientChangeFundPassword not implemented yet");
    }

    /** 中央交易系统调用：资金变更（外部接口 updateFundBalance），需 ref_order_id 幂等。 */
    default Object updateFundBalance(UpdateFundBalanceRequest request) {
        throw new UnsupportedOperationException("updateFundBalance not implemented yet");
    }

    default Object createFundAccount(CreateFundAccountRequest request) {
        throw new UnsupportedOperationException("createFundAccount not implemented yet");
    }

    default Object deposit(DepositRequest request) {
        throw new UnsupportedOperationException("deposit not implemented yet");
    }

    default Object withdraw(WithdrawRequest request) {
        throw new UnsupportedOperationException("withdraw not implemented yet");
    }

    default Object changeFundPassword(ChangeFundPasswordRequest request) {
        throw new UnsupportedOperationException("changeFundPassword not implemented yet");
    }

    default Object reportFundLoss(ReportFundLossRequest request) {
        throw new UnsupportedOperationException("reportFundLoss not implemented yet");
    }

    default Object reissueFundAccount(ReissueFundAccountRequest request) {
        throw new UnsupportedOperationException("reissueFundAccount not implemented yet");
    }

    default Object closeFundAccount(CloseFundAccountRequest request) {
        throw new UnsupportedOperationException("closeFundAccount not implemented yet");
    }

    default Object queryFundInfo(String fundAccNo, String idNumber, boolean includeLogs) {
        throw new UnsupportedOperationException("queryFundInfo not implemented yet");
    }
}
