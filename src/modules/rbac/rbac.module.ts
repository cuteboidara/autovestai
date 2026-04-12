import { Global, Module } from '@nestjs/common';

import { AdminPolicyService } from './admin-policy.service';

@Global()
@Module({
  providers: [AdminPolicyService],
  exports: [AdminPolicyService],
})
export class RbacModule {}
