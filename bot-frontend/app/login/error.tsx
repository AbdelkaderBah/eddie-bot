// app/login/error.tsx
'use client';

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function LoginError({ error }: { error: string }) {
    if (!error) return null;

    return (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
        </Alert>
    );
}

export default LoginError;