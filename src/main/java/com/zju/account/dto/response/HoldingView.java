package com.zju.account.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** 单只持仓��图，字段对齐《对外部子系统接口说明》§3.3。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class HoldingView {

    @JsonProperty("stock_code")
    private String stockCode;

    @JsonProperty("quantity")
    private Integer quantity;

    @JsonProperty("frozen_quantity")
    private Integer frozenQuantity;

    @JsonProperty("available_quantity")
    private Integer availableQuantity;

    @JsonProperty("avg_cost")
    private java.math.BigDecimal avgCost;
}
