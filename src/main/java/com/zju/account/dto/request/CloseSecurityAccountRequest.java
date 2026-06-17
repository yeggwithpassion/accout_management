package com.zju.account.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/** 销户证券账户（内部接口 closeSecurityAccount）。 */
@Data
public class CloseSecurityAccountRequest {

    @NotBlank
    @JsonProperty("sec_acc_no")
    private String secAccNo;

    @NotBlank
    @JsonProperty("id_number")
    private String idNumber;

    @NotNull
    @JsonProperty("staff_id")
    private Integer staffId;

    @JsonProperty("reason")
    private String reason;
}
