export interface Worker
{
    GetStatus(): { ScheduledTasks: number, Workers: number, MaxWorkers: number, IsWorking: boolean; };
    SetMaxWorkers(_MaxWorkers: number): void;
    ScheduleWork(...args: any[]): void;
    Work(): object;
    Destroy(): void;
}

interface ParallelScheduler
{
    LoadModule(module: ModuleScript): Worker;
    SharedTableToTable<T>(sharedTable: unknown): T;
}

declare const ParallelScheduler: ParallelScheduler;
export = ParallelScheduler;