package account.service;

import account.common.BusinessException;
import account.common.ErrorCode;
import account.dao.DaoRegistry;
import account.dao.model.DomainModels;
import account.dto.DeactivateStaffRequest;
import account.dto.StaffLoginRequest;
import account.dto.StaffLoginResponse;
import account.dto.StaffStatusResponse;
import account.service.api.StaffAuthTokenService;
import account.service.api.StaffService;
import java.time.LocalDateTime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class StaffServiceImpl implements StaffService {

    private final DaoRegistry dao;
    private final StaffAuthTokenService staffAuthTokenService;

    public StaffServiceImpl(DaoRegistry dao, StaffAuthTokenService staffAuthTokenService) {
        this.dao = dao;
        this.staffAuthTokenService = staffAuthTokenService;
    }

    @Override
    public StaffLoginResponse staffLogin(StaffLoginRequest request) {
        var staff = dao.staffDao().findByUsername(request.getUsername())
                .orElseThrow(() -> new BusinessException(ErrorCode.ERR_009, "工作人员不存在或密码错误"));

        if (!"正常".equals(staff.status())) {
            throw new BusinessException(ErrorCode.ERR_009, "工作人员账号不可用");
        }

        if (!PasswordUtil.verify(request.getPassword(), staff.passwordHash())) {
            throw new BusinessException(ErrorCode.ERR_009, "工作人员不存在或密码错误");
        }

        String authToken = staffAuthTokenService.issueToken(staff.staffId(), staff.username());
        log.info("[staffLogin] staff_id={} username={} status={}",
                staff.staffId(), staff.username(), staff.status());

        return StaffLoginResponse.builder()
                .staffId(staff.staffId())
                .username(staff.username())
                .status(staff.status())
                .authToken(authToken)
                .build();
    }

    @Override
    public StaffStatusResponse deactivateStaff(DeactivateStaffRequest request) {
        StaffStatusResponse response = dao.transactionManager().execute(connection -> {
            var targetStaff = dao.staffDao().findById(request.getTargetStaffId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.ERR_009, "工作人员不存在: " + request.getTargetStaffId()));

            if (!"正常".equals(targetStaff.status())) {
                throw new BusinessException(ErrorCode.ERR_011, "工作人员当前已不是正常状态");
            }

            dao.staffDao().update(connection, new DomainModels.Staff(
                    targetStaff.staffId(),
                    targetStaff.username(),
                    targetStaff.passwordHash(),
                    "禁用",
                    targetStaff.createdAt()
            ));

            dao.operationLogDao().create(connection, new DomainModels.OperationLog(
                    null,
                    request.getOperatorStaffId(),
                    "停用工作人员",
                    "STAFF",
                    String.valueOf(targetStaff.staffId()),
                    "停用工作人员 username=" + targetStaff.username()
                            + ", reason=" + (request.getReason() == null ? "" : request.getReason()),
                    LocalDateTime.now()
            ));

            return StaffStatusResponse.builder()
                    .staffId(targetStaff.staffId())
                    .username(targetStaff.username())
                    .status("禁用")
                    .build();
        });

        staffAuthTokenService.invalidateByStaffId(request.getTargetStaffId());
        return response;
    }
}
