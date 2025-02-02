"use client"

import React, { useState } from 'react';
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardDescription,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
    Brain,
    AlertTriangle,
    Plus,
    Settings,
    Trash2,
    Timer,
    TrendingUp,
    TrendingDown,
} from 'lucide-react';

type TriggerType = 'MASS_BUY' | 'MASS_SELL' | 'PRICE_JUMP' | 'PRICE_DROP';
type TimeFrame = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

interface TriggerCondition {
    type: TriggerType;
    percentage: number;
    timeFrame: TimeFrame;
}

interface BotAction {
    botId: string;
    takeProfit: number;
    stopLoss: number;
}

interface EddieChief {
    id: string;
    name: string;
    active: boolean;
    description: string;
    conditions: TriggerCondition[];
    actions: BotAction[];
    lastTriggered?: Date;
    successRate: number;
}

interface Bot {
    id: string;
    name: string;
    type: 'MANUAL' | 'EDDIE';
}

interface EddieChiefManagerProps {
    availableBots: Bot[];
    onCreateChief?: (chief: Omit<EddieChief, 'id'>) => void;
    onUpdateChief?: (id: string, updates: Partial<EddieChief>) => void;
    onDeleteChief?: (id: string) => void;
}

const initialChiefState: Omit<EddieChief, 'id'> = {
    name: '',
    active: false,
    description: '',
    conditions: [{
        type: 'PRICE_JUMP',
        percentage: 5,
        timeFrame: '5m'
    }],
    actions: [],
    successRate: 0
};

const EddieChiefManager: React.FC<EddieChiefManagerProps> = ({
                                                                 availableBots = [],
                                                                 onCreateChief,
                                                                 onUpdateChief,
                                                                 onDeleteChief
                                                             }) => {
    const [chiefs, setChiefs] = useState<EddieChief[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [editingChief, setEditingChief] = useState<EddieChief | null>(null);
    const [newChief, setNewChief] = useState<Omit<EddieChief, 'id'>>(initialChiefState);

    const handleCreateChief = () => {
        const chief: EddieChief = {
            id: crypto.randomUUID(),
            ...newChief
        };

        setChiefs(prev => [...prev, chief]);
        onCreateChief?.(newChief);
        setIsCreating(false);
        setNewChief(initialChiefState);
    };

    const handleUpdateChief = () => {
        if (!editingChief) return;

        setChiefs(prev =>
            prev.map(chief =>
                chief.id === editingChief.id ? editingChief : chief
            )
        );
        onUpdateChief?.(editingChief.id, editingChief);
        setEditingChief(null);
    };

    const handleDeleteChief = (id: string) => {
        setChiefs(prev => prev.filter(chief => chief.id !== id));
        onDeleteChief?.(id);
    };

    const handleToggleChief = (id: string, active: boolean) => {
        setChiefs(prev =>
            prev.map(chief =>
                chief.id === id ? { ...chief, active } : chief
            )
        );
        onUpdateChief?.(id, { active });
    };

    const renderChiefForm = (isEditing: boolean) => {
        const formData = isEditing ? editingChief : newChief;
        if (!formData) return null;

        const handleAddCondition = () => {
            const newCondition: TriggerCondition = {
                type: 'PRICE_JUMP',
                percentage: 5,
                timeFrame: '5m'
            };

            if (isEditing) {
                setEditingChief({
                    ...editingChief!,
                    conditions: [...editingChief!.conditions, newCondition]
                });
            } else {
                setNewChief({
                    ...newChief,
                    conditions: [...newChief.conditions, newCondition]
                });
            }
        };

        const handleAddAction = () => {
            const newAction: BotAction = {
                botId: availableBots[0]?.id || '',
                takeProfit: 5,
                stopLoss: 3
            };

            if (isEditing) {
                setEditingChief({
                    ...editingChief!,
                    actions: [...editingChief!.actions, newAction]
                });
            } else {
                setNewChief({
                    ...newChief,
                    actions: [...newChief.actions, newAction]
                });
            }
        };

        return (
            <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label htmlFor="name">Supervisor Name</Label>
                    <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => {
                            if (isEditing) {
                                setEditingChief({ ...editingChief!, name: e.target.value });
                            } else {
                                setNewChief({ ...newChief, name: e.target.value });
                            }
                        }}
                        placeholder="e.g., BTC Volatility Supervisor"
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) => {
                            if (isEditing) {
                                setEditingChief({ ...editingChief!, description: e.target.value });
                            } else {
                                setNewChief({ ...newChief, description: e.target.value });
                            }
                        }}
                        placeholder="Describe what this supervisor does"
                    />
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <Label>Trigger Conditions</Label>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAddCondition}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Condition
                        </Button>
                    </div>

                    {formData.conditions.map((condition, index) => (
                        <div key={index} className="grid grid-cols-3 gap-2 items-end border p-2 rounded">
                            <div>
                                <Label>Type</Label>
                                <Select
                                    value={condition.type}
                                    onValueChange={(value: TriggerType) => {
                                        const newConditions = [...formData.conditions];
                                        newConditions[index] = { ...condition, type: value };
                                        if (isEditing) {
                                            setEditingChief({ ...editingChief!, conditions: newConditions });
                                        } else {
                                            setNewChief({ ...newChief, conditions: newConditions });
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MASS_BUY">Mass Buy</SelectItem>
                                        <SelectItem value="MASS_SELL">Mass Sell</SelectItem>
                                        <SelectItem value="PRICE_JUMP">Price Jump</SelectItem>
                                        <SelectItem value="PRICE_DROP">Price Drop</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Percentage</Label>
                                <Input
                                    type="number"
                                    value={condition.percentage}
                                    onChange={(e) => {
                                        const newConditions = [...formData.conditions];
                                        newConditions[index] = { ...condition, percentage: Number(e.target.value) };
                                        if (isEditing) {
                                            setEditingChief({ ...editingChief!, conditions: newConditions });
                                        } else {
                                            setNewChief({ ...newChief, conditions: newConditions });
                                        }
                                    }}
                                    min={0}
                                    max={100}
                                />
                            </div>

                            <div>
                                <Label>Time Frame</Label>
                                <Select
                                    value={condition.timeFrame}
                                    onValueChange={(value: TimeFrame) => {
                                        const newConditions = [...formData.conditions];
                                        newConditions[index] = { ...condition, timeFrame: value };
                                        if (isEditing) {
                                            setEditingChief({ ...editingChief!, conditions: newConditions });
                                        } else {
                                            setNewChief({ ...newChief, conditions: newConditions });
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1m">1 minute</SelectItem>
                                        <SelectItem value="5m">5 minutes</SelectItem>
                                        <SelectItem value="15m">15 minutes</SelectItem>
                                        <SelectItem value="30m">30 minutes</SelectItem>
                                        <SelectItem value="1h">1 hour</SelectItem>
                                        <SelectItem value="4h">4 hours</SelectItem>
                                        <SelectItem value="1d">1 day</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <Label>Bot Actions</Label>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAddAction}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Action
                        </Button>
                    </div>

                    {formData.actions.map((action, index) => (
                        <div key={index} className="grid grid-cols-3 gap-2 items-end border p-2 rounded">
                            <div>
                                <Label>Bot</Label>
                                <Select
                                    value={action.botId}
                                    onValueChange={(value: string) => {
                                        const newActions = [...formData.actions];
                                        newActions[index] = { ...action, botId: value };
                                        if (isEditing) {
                                            setEditingChief({ ...editingChief!, actions: newActions });
                                        } else {
                                            setNewChief({ ...newChief, actions: newActions });
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableBots.map(bot => (
                                            <SelectItem key={bot.id} value={bot.id}>{bot.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Take Profit %</Label>
                                <Input
                                    type="number"
                                    value={action.takeProfit}
                                    onChange={(e) => {
                                        const newActions = [...formData.actions];
                                        newActions[index] = { ...action, takeProfit: Number(e.target.value) };
                                        if (isEditing) {
                                            setEditingChief({ ...editingChief!, actions: newActions });
                                        } else {
                                            setNewChief({ ...newChief, actions: newActions });
                                        }
                                    }}
                                    min={0}
                                    max={100}
                                />
                            </div>

                            <div>
                                <Label>Stop Loss %</Label>
                                <Input
                                    type="number"
                                    value={action.stopLoss}
                                    onChange={(e) => {
                                        const newActions = [...formData.actions];
                                        newActions[index] = { ...action, stopLoss: Number(e.target.value) };
                                        if (isEditing) {
                                            setEditingChief({ ...editingChief!, actions: newActions });
                                        } else {
                                            setNewChief({ ...newChief, actions: newActions });
                                        }
                                    }}
                                    min={0}
                                    max={100}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Eddie Chiefs</CardTitle>
                            <CardDescription>Market condition supervisors for automated trading</CardDescription>
                        </div>
                        <Dialog open={isCreating} onOpenChange={setIsCreating}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Supervisor
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[600px]">
                                <DialogHeader>
                                    <DialogTitle>Create New Supervisor</DialogTitle>
                                </DialogHeader>
                                {renderChiefForm(false)}
                                <div className="flex justify-end gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setIsCreating(false);
                                            setNewChief(initialChiefState);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleCreateChief}
                                        disabled={!newChief.name.trim() || newChief.conditions.length === 0 || newChief.actions.length === 0}
                                    >
                                        Create Supervisor
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Conditions</TableHead>
                                <TableHead>Actions</TableHead>
                                <TableHead>Success Rate</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {chiefs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center h-24">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <AlertTriangle className="h-8 w-8" />
                                            <p>No supervisors found. Create one to get started!</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

export default EddieChiefManager;