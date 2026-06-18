package com.zju.account.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 资金流水摘要，用于 getFundSnapshot 等接口的 recent_logs。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class FundLogView {

    @JsonProperty("log_id")
    private Long logId;

    @JsonProperty("txn_type")
    private String txnType;

    @JsonProperty("amount")
    private BigDecimal amount;

    @JsonProperty("txn_time")
    private LocalDateTime txnTime;

    @JsonProperty("ref_order_id")
    private String refOrderId;
}
