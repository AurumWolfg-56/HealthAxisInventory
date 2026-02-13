-- Fix missing forms.manage permission

-- 1. Insert permission if it doesn't exist
INSERT INTO public.permissions (id, description)
VALUES ('forms.manage', 'Create, update, and delete form templates')
ON CONFLICT (id) DO NOTHING;

-- 2. Assign permission to OWNER and MANAGER
INSERT INTO public.role_permissions (role_id, permission_id)
VALUES 
    ('OWNER', 'forms.manage'),
    ('MANAGER', 'forms.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. Also ensure forms.generate exists (for generating PDF) 
INSERT INTO public.permissions (id, description)
VALUES ('forms.generate', 'Generate PDF forms from templates')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
VALUES 
    ('OWNER', 'forms.generate'),
    ('MANAGER', 'forms.generate'),
    ('DOCTOR', 'forms.generate'),
    ('MA', 'forms.generate'),
    ('FRONT_DESK', 'forms.generate')
ON CONFLICT (role_id, permission_id) DO NOTHING;
