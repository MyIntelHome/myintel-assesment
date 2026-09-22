/** Internal planning only. Not a customer quote, tax calculation or payment instruction. */
export interface PricingScenario {
  priceCents:number;
  professionalCostCents:number;
  otherCostCents:number;
  processingBasisPoints:number;
  processingFixedCents:number;
}
export function pricingScenario(input:PricingScenario){
 for(const value of Object.values(input))if(!Number.isSafeInteger(value)||value<0)throw new Error('Use nonnegative whole-number cents and basis points.');
 if(input.processingBasisPoints>=10000)throw new Error('Processing rate must be below 100%.');
 const costs=input.professionalCostCents+input.otherCostCents+input.processingFixedCents;
 const product=input.priceCents*input.processingBasisPoints;
 if(!Number.isSafeInteger(costs)||!Number.isSafeInteger(product)||!Number.isSafeInteger(costs*10000))throw new Error('Scenario exceeds supported amounts.');
 const processingCents=Math.ceil(product/10000)+input.processingFixedCents;
 const contributionCents=input.priceCents-input.professionalCostCents-input.otherCostCents-processingCents;
 return {processingCents,contributionCents,breakEvenCents:Math.ceil(costs*10000/(10000-input.processingBasisPoints))};
}
