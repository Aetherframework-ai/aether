import { aether } from '@aether/sdk';
import { {{ workflow_name }} } from './workflows/{{ workflow_filename }}';

async function main() {
  console.log('Starting Aether workflow...');
  
  // 注册工作流并启动本地服务器
  await aether.serve([{{ workflow_name }}]);
  
  console.log('Server running at http://localhost:7233');
}

main().catch(console.error);
