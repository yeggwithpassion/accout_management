package com.zju.account.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** 管理员强制销户（adminCloseSecurityAccount，camelCase）。 */
@Data
public class AdminCloseSecurityAccountRequest {

    @NotBlank
    private String securityAccountNo;

    @NotBlank
    private String adminId;

    @NotBlank
    private String adminToken;

    @NotBlank
    private String forceReason;
}
