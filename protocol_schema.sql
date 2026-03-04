-- Create the protocols table
CREATE TABLE protocols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO', 'ROUTINE')),
    area TEXT NOT NULL CHECK (area IN ('FRONT_DESK', 'MA_STATION', 'EXAM_ROOM', 'LAB', 'GENERAL')),
    type TEXT NOT NULL CHECK (type IN ('STANDARD', 'HIPAA', 'OSHA')),
    requires_acknowledgment BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;

-- Policies for protocols
CREATE POLICY "Anyone can view protocols" ON protocols
    FOR SELECT USING (true);

CREATE POLICY "Owners and Managers can insert protocols" ON protocols
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('OWNER', 'MANAGER')
        )
    );

CREATE POLICY "Owners and Managers can update protocols" ON protocols
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('OWNER', 'MANAGER')
        )
    );

CREATE POLICY "Owners and Managers can delete protocols" ON protocols
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('OWNER', 'MANAGER')
        )
    );

-- Create the protocol acknowledgments table
CREATE TABLE protocol_acknowledgments (
    protocol_id UUID REFERENCES protocols(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (protocol_id, user_id)
);

-- Enable RLS
ALTER TABLE protocol_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Policies for protocol_acknowledgments
CREATE POLICY "Users can view all acknowledgments" ON protocol_acknowledgments
    FOR SELECT USING (true); -- Managers need to see all, users can see their own (or all for simplicity, safe internally)

CREATE POLICY "Users can insert their own acknowledgments" ON protocol_acknowledgments
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own acknowledgments" ON protocol_acknowledgments
    FOR UPDATE USING (user_id = auth.uid());

-- Function to automatically update 'updated_at' on protocols
CREATE OR REPLACE FUNCTION update_protocol_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_protocols_timestamp
BEFORE UPDATE ON protocols
FOR EACH ROW
EXECUTE FUNCTION update_protocol_updated_at();
