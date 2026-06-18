package com.zju.account.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;

/** 中央交易系统持仓变更（外部接口 updateSecurityHolding）。 */
@Data
public class UpdateSecurityHoldingRequest {

    @NotBlank
    @JsonProperty("sec_acc_no")
    private String secAccNo;

    @NotBlank
    @JsonProperty("stock_code")
    private String stockCode;

    @NotBlank
    @Pattern(regexp = "^(买入增加|卖出冻结|卖出扣减|撤单释放)$",
            message = "change_type 必须为 买入增加/卖出冻结/卖出扣减/撤单释放 之一")
    @JsonProperty("change_type")
    private String changeType;

    @NotNull
    @Positive
    @JsonProperty("quantity")
    private Integer quantity;

    /** 可选：买入时用于更新移动平均成本 */
    @JsonProperty("price")
    private BigDecimal price;
}
