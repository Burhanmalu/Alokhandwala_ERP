-- =============================================================================
-- ALOKHANDWALA SCAFFOLDING ERP - RLS POLICIES & SECURITY RULES
-- Migration: 00002_rls_and_policies.sql
-- =============================================================================

-- Enable RLS on core tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_material_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role code
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS VARCHAR AS $$
BEGIN
    RETURN (
        SELECT role_code FROM profiles 
        WHERE auth_user_id = auth.uid() 
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: Authenticated users can read active profiles; Super Admins can manage all
CREATE POLICY profiles_read_all ON profiles
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY profiles_super_admin_manage ON profiles
    FOR ALL TO authenticated
    USING (get_current_user_role() = 'SUPER_ADMIN')
    WITH CHECK (get_current_user_role() = 'SUPER_ADMIN');

-- Projects: 
-- Super Admin, Admin, Inventory Mgr, Accountant can view all projects.
-- Supervisors can view projects assigned to them or unassigned not_installed ones.
CREATE POLICY projects_read_policy ON projects
    FOR SELECT TO authenticated
    USING (
        get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN_PM', 'INVENTORY_MGR', 'ACCOUNTANT', 'VIEWER')
        OR (
            get_current_user_role() = 'SUPERVISOR'
            AND (
                assigned_supervisor_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
                OR status = 'NOT_INSTALLED'
            )
        )
    );

CREATE POLICY projects_write_policy ON projects
    FOR ALL TO authenticated
    USING (
        get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN_PM')
        OR (get_current_user_role() = 'SUPERVISOR' AND status = 'NOT_INSTALLED')
    );

-- Invoices & Payments: Restricted to Super Admin, Admin, and Accountant
CREATE POLICY finance_read_policy ON invoices
    FOR SELECT TO authenticated
    USING (get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN_PM', 'ACCOUNTANT'));

CREATE POLICY finance_write_policy ON invoices
    FOR ALL TO authenticated
    USING (get_current_user_role() IN ('SUPER_ADMIN', 'ACCOUNTANT'));

CREATE POLICY payments_read_policy ON payments
    FOR SELECT TO authenticated
    USING (get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN_PM', 'ACCOUNTANT'));

CREATE POLICY payments_write_policy ON payments
    FOR ALL TO authenticated
    USING (get_current_user_role() IN ('SUPER_ADMIN', 'ACCOUNTANT'));

-- Notifications: Users only see their own notifications or role targets
CREATE POLICY notifications_select_policy ON notifications
    FOR SELECT TO authenticated
    USING (
        user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
        OR role_target = get_current_user_role()
    );

CREATE POLICY notifications_update_policy ON notifications
    FOR UPDATE TO authenticated
    USING (
        user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
        OR role_target = get_current_user_role()
    );

-- Audit logs: Viewable by Super Admin and Admin, insertable by system/authenticated
CREATE POLICY audit_logs_read_policy ON audit_logs
    FOR SELECT TO authenticated
    USING (get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN_PM'));

CREATE POLICY audit_logs_insert_policy ON audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (TRUE);
