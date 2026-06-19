package account.service;

import account.dto.DeactivateStaffRequest;
import account.dto.StaffStatusResponse;
import account.dto.StaffLoginRequest;
import account.dto.StaffLoginResponse;

public interface StaffService {

    StaffLoginResponse staffLogin(StaffLoginRequest request);

    StaffStatusResponse deactivateStaff(DeactivateStaffRequest request);
}
