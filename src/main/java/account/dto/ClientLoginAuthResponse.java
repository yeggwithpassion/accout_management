package account.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ClientLoginAuthResponse {

    @JsonProperty("auth_token")
    private String authToken;

    @JsonProperty("fund_acc_no")
    private String fundAccNo;

    @JsonProperty("sec_acc_no")
    private String secAccNo;

    @JsonProperty("status")
    private String status;
}
