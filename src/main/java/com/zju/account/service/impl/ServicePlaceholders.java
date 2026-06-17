package com.zju.account.service.impl;

import com.zju.account.service.AdminService;
import com.zju.account.service.AuditService;
import com.zju.account.service.FundAccountService;
import com.zju.account.service.SecurityAccountService;
import com.zju.account.service.StaffService;
import org.springframework.stereotype.Service;

/**
 * 临时占位 Service 实现。
 *
 * 真实 Service 与 DAO 尚未完成；此处提供 @Service Bean 以便 Spring 注入。
 * 所有方法依旧抛出 UnsupportedOperationException，由 Controller 捕获并走 Mock 数据兜底，
 * 不会影响联调；待真实实现就绪后，删除此类或替换其中的方法即可。
 */
public class ServicePlaceholders {

    @Service
    public static class FundAccountServicePlaceholder implements FundAccountService { }

    @Service
    public static class SecurityAccountServicePlaceholder implements SecurityAccountService { }

    @Service
    public static class StaffServicePlaceholder implements StaffService { }

    @Service
    public static class AdminServicePlaceholder implements AdminService { }

    @Service
    public static class AuditServicePlaceholder implements AuditService { }
}
