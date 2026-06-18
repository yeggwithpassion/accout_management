package com.zju.account.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** 操作日志视图，用于 queryOperationLog 返回。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OperationLogView {

    private Long logId;
    private Integer staffId;
    private String operationType;
    private String targetType;
    private String targetId;
    private String detail;
    private LocalDateTime operationTime;
}
