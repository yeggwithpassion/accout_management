package com.zju.account.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/** 补办证券账户（内部接口 reissueSecurityAccount）。 */
@Data
public class ReissueSecurityAccountRequest {

    @NotBlank
    @JsonProperty("old_sec_acc_no")
    private String oldSecAccNo;

    @NotBlank
    @JsonProperty("id_number")
    private String idNumber;

    @NotNull
    @JsonProperty("staff_id")
    private Integer staffId;
}
