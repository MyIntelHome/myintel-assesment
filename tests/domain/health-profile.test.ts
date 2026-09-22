import {expect,it} from 'vitest';
import {EMPTY_PROFILE,profileSchema,profileLines} from '@/domain/home-profile';
import {healthNextSteps,healthProfileLines} from '@/domain/health-profile';
import {homeActionsText} from '@/domain/home-actions';
import {buildFamilyReport} from '@/domain/family-report';

it('accepts existing profiles without inventing health answers',()=>{
 const p=profileSchema.parse(EMPTY_PROFILE);
 expect(p.movement).toBeUndefined();
 expect(healthProfileLines(p)).toEqual([]);
 expect(healthNextSteps(p)).toEqual([]);
});
it('preserves optional health answers and rejects unknown values',()=>{
 const p={...EMPTY_PROFILE,movement:'help' as const,movementTask:'transfers' as const,foodAccess:'shopping' as const};
 expect(profileSchema.parse(JSON.parse(JSON.stringify(p)))).toEqual(p);
 expect(profileLines(p).join(' ')).toContain('chair or bed');
 expect(profileSchema.safeParse({...p,hydration:'eight_glasses'}).success).toBe(false);
});
it('does not report a stale movement follow-up after the parent answer changes',()=>{
 expect(healthProfileLines({...EMPTY_PROFILE,movement:'comfortable',movementTask:'stairs'}).join(' ')).not.toContain('steps or stairs');
});
it('does not treat declined answers as concerns',()=>{
 expect(healthNextSteps({...EMPTY_PROFILE,movement:'prefer_not',fallConcern:'prefer_not',meals:'prefer_not',foodAccess:'prefer_not',appetite:'prefer_not',hydration:'prefer_not'})).toEqual([]);
});
it('includes reported needs and cautious next steps in export without changing room scores',()=>{
 const report=buildFamilyReport([],{}),before=JSON.stringify(report);
 const text=homeActionsText(report,{...EMPTY_PROFILE,fallConcern:'fall',foodAccess:'both',appetite:'swallowing',hydration:'care_plan'});
 expect(text).toContain('walking-aid');expect(text).toContain('groceries');expect(text).toContain('choking');
 expect(text).not.toContain('keeping drinks within reach');
 expect(JSON.stringify(report)).toBe(before);
});
