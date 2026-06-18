package com.zju.account.dto.request;

import com.zju.account.enums.AccountType;
import com.zju.account.enums.FreezeType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/** 管理员强制冻结/解冻账户（admin 系列接口 adminFreezeAccount / adminUnfreezeAccount，使用 camelCase）。 */
@Data
public class AdminFreezeRequest {

    @NotNull
    private AccountType accountType;

    @NotBlank
    private String accountNo;

    @NotNull
    private FreezeType freezeType;

    @NotBlank
    private String adminId;

    @NotBlank
    private String adminToken;

    private String reason;
}
