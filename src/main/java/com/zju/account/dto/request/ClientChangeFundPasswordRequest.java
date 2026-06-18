package com.zju.account.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/** 修改交易密码或取款密码（外部接口 clientChangeFundPassword）。 */
@Data
public class ClientChangeFundPasswordRequest {

    @NotBlank
    @JsonProperty("fund_acc_no")
    private String fundAccNo;

    @NotBlank
    @Pattern(regexp = "^(trade|withdraw)$", message = "password_type 必须为 trade 或 withdraw")
    @JsonProperty("password_type")
    private String passwordType;

    @NotBlank
    @JsonProperty("old_password")
    private String oldPassword;

    @NotBlank
    @JsonProperty("new_password")
    private String newPassword;
}
