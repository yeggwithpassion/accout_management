package com.zju.account.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/** 开立证券账户（内部接口 createSecurityAccount）。 */
@Data
public class CreateSecurityAccountRequest {

    @NotBlank
    @Pattern(regexp = "^(个人|法人)$", message = "investor_type 必须为 个人 或 法人")
    @JsonProperty("investor_type")
    private String investorType;

    @NotBlank
    @JsonProperty("name")
    private String name;

    @NotBlank
    @JsonProperty("id_type")
    private String idType;

    @NotBlank
    @JsonProperty("id_number")
    private String idNumber;

    @JsonProperty("phone")
    private String phone;

    @JsonProperty("address")
    private String address;

    @JsonProperty("occupation")
    private String occupation;

    @JsonProperty("education")
    private String education;

    @JsonProperty("legal_number")
    private String legalNumber;

    @JsonProperty("business_license")
    private String businessLicense;

    @JsonProperty("authorize_name")
    private String authorizeName;

    @JsonProperty("authorize_phone")
    private String authorizePhone;

    @JsonProperty("authorize_address")
    private String authorizeAddress;

    @JsonProperty("executor_name")
    private String executorName;

    @JsonProperty("agent_name")
    private String agentName;

    @JsonProperty("agent_id_number")
    private String agentIdNumber;

    @NotNull
    @JsonProperty("staff_id")
    private Integer staffId;
}
