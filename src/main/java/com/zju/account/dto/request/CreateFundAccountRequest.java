package com.zju.account.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/** 开立资金账户（内部接口 createFundAccount）。 */
@Data
public class CreateFundAccountRequest {

    @NotBlank
    @JsonProperty("sec_acc_no")
    private String secAccNo;

    @NotBlank
    @JsonProperty("id_number")
    private String idNumber;

    @NotBlank
    @JsonProperty("trade_password")
    private String tradePassword;

    @NotBlank
    @JsonProperty("withdraw_password")
    private String withdrawPassword;

    @JsonProperty("currency")
    private String currency;

    @NotNull
    @JsonProperty("staff_id")
    private Integer staffId;
}
