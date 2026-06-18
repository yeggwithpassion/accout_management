package com.zju.account.service.impl;

import account.dao.DaoRegistry;
import com.zju.account.common.BusinessException;
import com.zju.account.common.ErrorCode;
import com.zju.account.dto.request.StaffLoginRequest;
import com.zju.account.service.StaffService;
import com.zju.account.service.util.PasswordUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 工作人员登录 Service 实现。
 */
@Slf4j
@Service
public class StaffServiceImpl implements StaffService {

    private final DaoRegistry dao;

    public StaffServiceImpl(DaoRegistry dao) {
        this.dao = dao;
    }

    @Override
    public Map<String, Object> staffLogin(StaffLoginRequest request) {
        var staff = dao.staffDao().findByUsername(request.getUsername())
                .orElseThrow(() -> new BusinessException(ErrorCode.ERR_009, "工作人员不存在或密码错误"));

        // 验证密码
        if (!PasswordUtil.verify(request.getPassword(), staff.passwordHash())) {
            throw new BusinessException(ErrorCode.ERR_009, "工作人员不存在或密码错误");
        }

        String authToken = PasswordUtil.generateAuthToken();
        log.info("[staffLogin] staff_id={} username={} permission_level={}",
                staff.staffId(), staff.username(), staff.permissionLevel());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("staff_id", staff.staffId());
        result.put("username", staff.username());
        result.put("permission_level", staff.permissionLevel());
        result.put("auth_token", authToken);
        return result;
    }
}
