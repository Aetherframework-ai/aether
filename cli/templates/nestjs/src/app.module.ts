import { Module } from '@nestjs/common';
import { WorkflowController } from './workflows/workflow.controller';
import { WorkflowService } from './workflows/workflow.service';

@Module({
  imports: [],
  controllers: [WorkflowController],
  providers: [WorkflowService],
})
export class AppModule {}
