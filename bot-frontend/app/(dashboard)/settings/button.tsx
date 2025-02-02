'use client';

import {DropdownMenuItem} from "@/components/ui/dropdown-menu";
import {redirect} from "next/navigation";

export function SettingButton() {
    return (
        <DropdownMenuItem onClick={() => redirect('/settings')}>Settings</DropdownMenuItem>
    );
}

export default SettingButton;