import {describe,expect,it} from 'vitest';
import {dailyLifeQuestions} from '../../src/domain/routine-questions';
import {EMPTY_PROFILE} from '../../src/domain/home-profile';

const keys=(profile=EMPTY_PROFILE,moreContext=false)=>dailyLifeQuestions(profile,moreContext).map(q=>q.key);

describe('short daily-life path',()=>{
 it('asks eight default questions while keeping extra context available',()=>{
  expect(keys()).toEqual(['forWhom','mobility','movement','fallConcern','meals','foodAccess','goal','helpReach']);
  expect(keys(EMPTY_PROFILE,true)).toEqual(['appetite','hydration','livingWith','routines','helpStyle','technology']);
 });
 it('adds movement and eating follow-ups only when relevant',()=>{
  expect(keys({...EMPTY_PROFILE,movement:'difficult',meals:'often_skipped'})).toEqual(['forWhom','mobility','movement','movementTask','fallConcern','meals','foodAccess','appetite','goal','helpReach']);
  expect(keys({...EMPTY_PROFILE,movement:'comfortable',foodAccess:'preparing'})).toContain('appetite');
  expect(keys({...EMPTY_PROFILE,movement:'comfortable',meals:'regular',foodAccess:'manageable'})).not.toContain('movementTask');
 });
});
