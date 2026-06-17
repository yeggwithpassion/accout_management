package com.zju.account.service;

import com.zju.account.dto.request.AdminCloseSecurityAccountRequest;
import com.zju.account.dto.request.AdminFreezeRequest;
import com.zju.account.dto.request.SettleAnnualInterestRequest;

/** 管理员接口 Service：年度结息、强制冻结/解冻、强制销户、账户详情。 */
public interface AdminService {

    default Object settleAnnualInterest(SettleAnnualInterestRequest request) {
        throw new UnsupportedOperationException("settleAnnualInterest not implemented yet");
    }

    default Object adminFreezeAccount(AdminFreezeRequest request) {
        throw new UnsupportedOperationException("adminFreezeAccount not implemented yet");
    }

    default Object adminUnfreezeAccount(AdminFreezeRequest request) {
        throw new UnsupportedOperationException("adminUnfreezeAccount not implemented yet");
    }

    default Object adminGetAccountDetails(String accountNo, String adminId, String adminToken) {
        throw new UnsupportedOperationException("adminGetAccountDetails not implemented yet");
    }

    default Object adminCloseSecurityAccount(AdminCloseSecurityAccountRequest request) {
        throw new UnsupportedOperationException("adminCloseSecurityAccount not implemented yet");
    }
}
