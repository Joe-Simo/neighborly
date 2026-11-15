import type { ComponentType } from "react";
import type { LiveArea } from "@/components/workspace/areas";
import { WeekSection } from "@/components/workspace/volunteer/week";
import { TeamsSection } from "@/components/workspace/volunteer/teams";
import { PeopleSection } from "@/components/workspace/volunteer/people";
import { CommitmentsSection } from "@/components/workspace/volunteer/commitments";
import { MineSection } from "@/components/workspace/volunteer/mine";
import { TimeOffSection } from "@/components/workspace/volunteer/time-off";
import { TasksSection } from "@/components/workspace/volunteer/tasks";
import { HelpLineSection } from "@/components/workspace/help-line/help-line";
import { NeighborsSection } from "@/components/workspace/help-line/neighbors";
import { TreasurySection } from "@/components/workspace/treasury/treasury";
import { ReportsSection } from "@/components/workspace/reports/reports";
import { VisitsSection } from "@/components/workspace/visits/visits";
import { ToolsSection } from "@/components/workspace/tools/tools";

export const sections: Record<LiveArea, ComponentType> = {
  week: WeekSection,
  team: TeamsSection,
  people: PeopleSection,
  commitments: CommitmentsSection,
  mine: MineSection,
  "time-off": TimeOffSection,
  tasks: TasksSection,
  "help-line": HelpLineSection,
  neighbors: NeighborsSection,
  treasury: TreasurySection,
  reports: ReportsSection,
  visits: VisitsSection,
  tools: ToolsSection,
};
