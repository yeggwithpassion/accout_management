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
    default void clientChangeFundPassword(ClientChangeFundPasswordRequest request) {
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

    default void changeFundPassword(ChangeFundPasswordRequest request) {
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

    /** 查询资金账户基本信息及流水（内部接口 queryFundInfo）。 */
    default Object queryFundInfo(String fundAccNo, String idNumber, boolean includeLogs) {
        throw new UnsupportedOperationException("queryFundInfo not implemented yet");
    }

    /**
     * 绑定证券账户与资金账户（外部接口 bindSecurityAccount）。
     * 资金账户开立成功后，建立证券账户与资金账户的关联关系。
     *
     * @param fundAccNo 资金账户号
     * @param secAccNo  证券账户号
     * @return 绑定结果，包含 fund_acc_no、sec_acc_no、status
     * @throws com.zju.account.common.BusinessException ERR_005 证券账户不存在、
     *         ERR_006 该投资者已拥有其他证券账户、
     *         ERR_013 证券账户持有人与投资者身份证不一致、
     *         ERR_014 该资金账户已绑定其他证券账户
     */
    default Object bindSecurityAccount(String fundAccNo, String secAccNo) {
        throw new UnsupportedOperationException("bindSecurityAccount not implemented yet");
    }

    /**
     * 解除证券账户与资金账户的绑定（外部接口 unbindSecurityAccount）。
     * 资金账户销户时调用，断开双向关联。
     *
     * @param fundAccNo 资金账户号
     * @param secAccNo  证券账户号
     * @return 解绑结果
     * @throws com.zju.account.common.BusinessException ERR_007 资金账户尚有余额或冻结资金，
     *         ERR_015 该资金账户未绑定任何证券账户、
     *         ERR_016 资金账户存在未成交委托单、
     *         ERR_017 资金账户处于冻结状态
     */
    default Object unbindSecurityAccount(String fundAccNo, String secAccNo) {
        throw new UnsupportedOperationException("unbindSecurityAccount not implemented yet");
    }
}
