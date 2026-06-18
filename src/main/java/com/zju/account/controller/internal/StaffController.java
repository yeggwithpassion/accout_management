package com.zju.account.controller.internal;

import com.zju.account.common.Result;
import com.zju.account.dto.request.StaffLoginRequest;
import com.zju.account.service.StaffService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 工作人员登录（§7.1.1 staffLogin）。 */
@Slf4j
@RestController
@RequestMapping("/api/v1/internal/staff")
@RequiredArgsConstructor
public class StaffController {

    private final StaffService staffService;

    @PostMapping("/login")
    public Result<Void> staffLogin(@Valid @RequestBody StaffLoginRequest request) {
        log.info("[staffLogin] username={}", request.getUsername());
        try {
            Object data = staffService.staffLogin(request);
            if (data instanceof java.util.Map<?, ?> m) {
                Result<Void> r = Result.success("登录成功");
                ((java.util.Map<String, Object>) m).forEach((k, v) -> r.put(String.valueOf(k), v));
                return r;
            }
            return Result.<Void>success("登录成功").put("staff_id", data);
        } catch (UnsupportedOperationException notReady) {
            // TODO: 待Service层完善后替换
            log.warn("[staffLogin] Service 未就绪，返回 Mock 数据");
            return Result.<Void>success("登录成功").put("staff_id", 1001);
        }
    }
}
