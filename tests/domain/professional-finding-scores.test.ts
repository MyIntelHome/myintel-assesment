import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { normalise } from "@/lib/case-store";
import { templateFor } from "@/seed/templates";
import { professionalFindingScores } from "@/domain/professional-finding-scores";
import { FindingsDashboard, FindingScoreCard } from "@/components/FindingsDashboard";
const fixture=()=>normalise({id:'score',audience:'clinician',spaces:[{id:'door',type:'entry',label:'Entrance'},{id:'living',type:'living',label:'Living room'}],responses:{door:{e1:{status:'concern'},e2:{status:'pass'},e3:{status:'pass'},e4:{status:'critical'},e5:{status:'not_applicable',reason:'No steps'},e6:{status:'unable_to_assess',reason:'Not accessible'}}}});
describe('professional findings scores',()=>{
  it('scores each category and room from its own assessed checks rather than completion',()=>{
    const scores=professionalFindingScores(fixture());
    expect(scores.overall).toMatchObject({examined:4,findings:2,percent:50,critical:1,incomplete:true});
    expect(scores.categories.find(c=>c.id==='surfaces')).toMatchObject({examined:2,findings:1,percent:50});
    expect(scores.categories.find(c=>c.id==='lighting')).toMatchObject({examined:1,findings:0,percent:0});
    expect(scores.categories.find(c=>c.id==='access')).toMatchObject({examined:1,critical:1,percent:100,unable:1});
    expect(scores.rooms[0]).toMatchObject({percent:50,pending:1,unable:1});
    expect(scores.rooms[1]).toMatchObject({examined:0,percent:null,pending:6});
  });
  it('does not improve a score when blank, N/A or unable checks are added',()=>{
    const state=fixture();
    expect(professionalFindingScores(state).overall.percent).toBe(50);
    state.responses.door!.e7={status:'not_applicable',reason:'Outside visit scope'};
    expect(professionalFindingScores(state).overall.percent).toBe(50);
    state.responses.door!.e7={status:'unable_to_assess',reason:'Not visible'};
    expect(professionalFindingScores(state).overall.percent).toBe(50);
  });
  it('includes an assessed optional critical finding without counting unassessed optional items as passes',()=>{
    const state=fixture();const item=templateFor('living').items.find(i=>!i.required)!;
    state.responses.living={[item.code]:{status:'critical'}};
    const scores=professionalFindingScores(state);
    expect(scores.overall).toMatchObject({examined:5,findings:3,critical:2,percent:60});
    expect(scores.rooms[1]).toMatchObject({examined:1,critical:1,percent:100});
  });
  it('keeps a low score provisional and a critical finding prominent',()=>{
    const state=fixture();state.responses.door!.e1={status:'pass'};
    const html=renderToStaticMarkup(createElement(FindingsDashboard,{state}));
    expect(html).toContain('25%');expect(html).toContain('pr-critical-metric');
    expect(html).toContain('Scores are provisional');
    const card=renderToStaticMarkup(createElement(FindingScoreCard,{title:'Entrance',score:professionalFindingScores(state).overall}));
    expect(card).toContain('1 critical finding');
    expect(html).not.toContain('Observation coverage');expect(html).not.toContain('Checklist decisions');
  });
  it('does not report zero concerns as a score when nothing has been examined',()=>{
    const state=fixture();state.responses={};
    expect(professionalFindingScores(state).overall.percent).toBeNull();
    const html=renderToStaticMarkup(createElement(FindingsDashboard,{state}));
    expect(html).toContain('Not assessed');expect(html).not.toContain('<strong>0%</strong>');
  });
  it('never rounds a recorded concern down to a zero-percent label',()=>{
    const state=fixture();state.spaces=Array.from({length:100},(_,i)=>({id:`door${i}`,type:'entry',label:`Entrance ${i}`}));
    state.responses=Object.fromEntries(state.spaces.map(s=>[s.id,Object.fromEntries(templateFor('entry').items.map(item=>[item.code,{status:'pass'}]))]));
    state.responses.door0!.e1={status:'critical'};
    const score=professionalFindingScores(state).overall;
    const html=renderToStaticMarkup(createElement(FindingScoreCard,{title:'Large visit',score}));
    expect(score.findings).toBe(1);expect(html).toContain('&lt;1%');expect(html).toContain('1 critical finding');
  });
});
