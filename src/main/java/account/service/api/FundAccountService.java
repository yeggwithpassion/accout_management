package account.service.api;

import account.dto.ChangeFundPasswordRequest;
import account.dto.AccountBindingResponse;
import account.dto.AccountStatusResponse;
import account.dto.ClientChangeFundPasswordRequest;
import account.dto.ClientLoginAuthResponse;
import account.dto.CloseFundAccountRequest;
import account.dto.CreateFundAccountRequest;
import account.dto.DepositRequest;
import account.dto.FundAccountCreatedResponse;
import account.dto.FundAccountListItemResponse;
import account.dto.FundBalanceChangeResponse;
import account.dto.FundInfoResponse;
import account.dto.FundSnapshotResponse;
import account.dto.FundTradeUpdateResponse;
import account.dto.FundReissueResponse;
import account.dto.ReissueFundAccountRequest;
import account.dto.ReportFundLossRequest;
import account.dto.UpdateFundBalanceRequest;
import account.dto.WithdrawRequest;
import java.util.List;

public interface FundAccountService {

    FundAccountCreatedResponse createFundAccount(CreateFundAccountRequest request);

    FundBalanceChangeResponse deposit(DepositRequest request);

    FundBalanceChangeResponse withdraw(WithdrawRequest request);

    void changeFundPassword(ChangeFundPasswordRequest request);

    AccountStatusResponse reportFundLoss(ReportFundLossRequest request);

    FundReissueResponse reissueFundAccount(ReissueFundAccountRequest request);

    AccountStatusResponse closeFundAccount(CloseFundAccountRequest request);

    FundInfoResponse queryFundInfo(String fundAccNo, String idNumber, boolean includeLogs, Integer staffId);

    ClientLoginAuthResponse clientLoginAuth(String fundAccNo, String tradePassword);

    FundSnapshotResponse getFundSnapshot(String fundAccNo, String authToken);

    void clientChangeFundPassword(ClientChangeFundPasswordRequest request);

    FundTradeUpdateResponse updateFundBalance(UpdateFundBalanceRequest request);

    AccountBindingResponse bindSecurityAccount(String fundAccNo, String secAccNo, Integer staffId);

    AccountBindingResponse unbindSecurityAccount(String fundAccNo, String secAccNo, Integer staffId);

    List<FundAccountListItemResponse> listAllFundAccounts();
}
