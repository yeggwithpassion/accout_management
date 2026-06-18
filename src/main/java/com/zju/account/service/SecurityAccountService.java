package com.zju.account.service;

import com.zju.account.dto.request.*;

/** 证券账户业务 Service 接口。Service 实现尚未就绪，未实现方法抛 {@link UnsupportedOperationException}。 */
public interface SecurityAccountService {

    default Object getSecuritySnapshot(String secAccNo, String stockCode) {
        throw new UnsupportedOperationException("getSecuritySnapshot not implemented yet");
    }

    default Object updateSecurityHolding(UpdateSecurityHoldingRequest request) {
        throw new UnsupportedOperationException("updateSecurityHolding not implemented yet");
    }

    default Object createSecurityAccount(CreateSecurityAccountRequest request) {
        throw new UnsupportedOperationException("createSecurityAccount not implemented yet");
    }

    default Object reportSecurityLoss(ReportSecurityLossRequest request) {
        throw new UnsupportedOperationException("reportSecurityLoss not implemented yet");
    }

    default Object reissueSecurityAccount(ReissueSecurityAccountRequest request) {
        throw new UnsupportedOperationException("reissueSecurityAccount not implemented yet");
    }

    default Object closeSecurityAccount(CloseSecurityAccountRequest request) {
        throw new UnsupportedOperationException("closeSecurityAccount not implemented yet");
    }
}
