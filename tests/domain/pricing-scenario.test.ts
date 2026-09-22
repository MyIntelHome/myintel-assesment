import {expect,it} from 'vitest';
import {pricingScenario} from '@/domain/pricing-scenario';
const base={priceCents:10000,professionalCostCents:6000,otherCostCents:1000,processingBasisPoints:300,processingFixedCents:30};
it('models explicit costs without inventing provider pricing',()=>{
 expect(pricingScenario(base)).toEqual({processingCents:330,contributionCents:2670,breakEvenCents:7248});
});
it('break-even covers rounding and one cent less does not',()=>{
 const price=pricingScenario(base).breakEvenCents;
 expect(pricingScenario({...base,priceCents:price}).contributionCents).toBeGreaterThanOrEqual(0);
 expect(pricingScenario({...base,priceCents:price-1}).contributionCents).toBeLessThan(0);
});
it('rejects unsafe and fractional monetary inputs',()=>{
 for(const priceCents of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER])expect(()=>pricingScenario({...base,priceCents})).toThrow();
 expect(()=>pricingScenario({...base,processingBasisPoints:10000})).toThrow();
});
