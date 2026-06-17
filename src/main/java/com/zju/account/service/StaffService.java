package com.zju.account.service;

import com.zju.account.dto.request.StaffLoginRequest;

public interface StaffService {

    default Object staffLogin(StaffLoginRequest request) {
        throw new UnsupportedOperationException("staffLogin not implemented yet");
    }
}
