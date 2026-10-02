"use client";
import { useForm } from "@tanstack/react-form";
import { AGE_CHOICES, ANSWER_CHOICES, PLANNING_FIELDS, type PlanningAnswers, planningFormSchema, VENUE_CHOICES } from "@workspace/shared/events/planning";
import { FOOD_PURCHASER_LABELS } from "@workspace/shared/semester/labels";
import { convexErrorMessage } from "@workspace/shared/utils";
import { useId, useState, type ReactNode } from "react";
import { Button } from "./button";
import { Field, FieldDescription, FieldError, FieldLabel } from "./field";
import { Input } from "./input";
import { RichTextEditor } from "./rich-text-editor";
import { Textarea } from "./textarea";

type ChoiceKey="venue"|"foodAndDrinks"|"foodPurchasedBy"|"alcohol"|"ageRestriction"|"stand";
const selectClass="h-11 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export function EventPlanningForm({initial,capacityLimit,onSubmit,submitLabel="Send inn opplysninger",before,after}:Readonly<{
 initial:PlanningAnswers;capacityLimit:number;onSubmit:(answers:PlanningAnswers)=>Promise<unknown>;submitLabel?:string;before?:ReactNode;after?:ReactNode;
}>){
 const prefix=useId();
 const [error,setError]=useState("");
 const form=useForm({defaultValues:initial,validators:{onSubmit:planningFormSchema(capacityLimit)},onSubmit:async({value})=>{
  setError("");try{await onSubmit(value);}catch(e){setError(convexErrorMessage(e,"Kunne ikke lagre. Opplysningene er bevart i skjemaet. Prøv igjen."));}
 }});
 function text(name:keyof typeof PLANNING_FIELDS){
  const copy=PLANNING_FIELDS[name];
  return <form.Field key={name} name={name}>{field=><Field>
   <FieldLabel htmlFor={`${prefix}-${name}`} className="text-base">{copy.label}</FieldLabel>
   <FieldDescription id={`${prefix}-${name}-hint`}>{copy.hint}</FieldDescription>
   {name==="description"?<RichTextEditor id={`${prefix}-${name}`} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur} invalid={field.state.meta.errors.length>0}/>:
    name==="title"?<Input id={`${prefix}-${name}`} aria-describedby={`${prefix}-${name}-hint`} value={field.state.value} maxLength={copy.max} onChange={e=>field.handleChange(e.target.value)} onBlur={field.handleBlur}/>:
    <Textarea id={`${prefix}-${name}`} aria-describedby={`${prefix}-${name}-hint`} value={field.state.value} maxLength={copy.max} rows={name==="teaser"?3:4} onChange={e=>field.handleChange(e.target.value)} onBlur={field.handleBlur}/>}
   <FieldError errors={field.state.meta.errors}/>
  </Field>}</form.Field>;
 }
 function choice(name:ChoiceKey,label:string,options:Record<string,string>,hint?:string){
  return <form.Field name={name}>{field=><Field><FieldLabel htmlFor={`${prefix}-${name}`} className="text-base">{label}</FieldLabel>
   {hint&&<FieldDescription id={`${prefix}-${name}-hint`}>{hint}</FieldDescription>}
   <select id={`${prefix}-${name}`} className={selectClass} aria-describedby={hint?`${prefix}-${name}-hint`:undefined} value={field.state.value} onBlur={field.handleBlur} onChange={e=>{
    field.handleChange(e.target.value as PlanningAnswers[ChoiceKey]);
    if((name==="venue"&&e.target.value==="escape")||(name==="alcohol"&&e.target.value==="yes"))form.setFieldValue("ageRestriction","18");
   }}>{Object.entries(options).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><FieldError errors={field.state.meta.errors}/>
  </Field>}</form.Field>;
 }
 return <form className="space-y-10 text-left" onSubmit={e=>{e.preventDefault();e.stopPropagation();void form.handleSubmit();}}>
  {before}
  <section className="space-y-6 border-t pt-7"><h2 className="font-bold text-[22px]">Innhold til arrangementssiden</h2>
   {text("title")}{text("teaser")}{text("description")}
   <form.Field name="language">{field=><Field><FieldLabel htmlFor={`${prefix}-language`} className="text-base">Hvilket språk holdes arrangementet på?</FieldLabel><Input id={`${prefix}-language`} list={`${prefix}-languages`} value={field.state.value} onChange={e=>field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="Norsk, engelsk eller et annet språk" maxLength={100}/><datalist id={`${prefix}-languages`}><option value="Norsk"/><option value="Engelsk"/></datalist><FieldDescription>La feltet stå tomt hvis det ikke er avklart.</FieldDescription><FieldError errors={field.state.meta.errors}/></Field>}</form.Field>
  </section>
  <section className="space-y-6 border-t pt-7"><h2 className="font-bold text-[22px]">Tid og sted</h2>
   <div className="grid gap-6 sm:grid-cols-2">
    <form.Field name="startTime">{field=><Field><FieldLabel htmlFor={`${prefix}-time`} className="text-base">Når ønsker dere å starte?</FieldLabel><Input id={`${prefix}-time`} type="time" value={field.state.value} onChange={e=>field.handleChange(e.target.value)} onBlur={field.handleBlur}/><FieldDescription>Vi anbefaler kl. 16:15 eller senere, etter studentenes forelesninger.</FieldDescription><FieldError errors={field.state.meta.errors}/></Field>}</form.Field>
    <form.Field name="capacity">{field=><Field><FieldLabel htmlFor={`${prefix}-capacity`} className="text-base">Hvor mange studenter ønsker dere?</FieldLabel><Input id={`${prefix}-capacity`} type="number" min={1} max={capacityLimit} step={1} value={Number.isNaN(field.state.value)?"":field.state.value} onChange={e=>field.handleChange(e.target.valueAsNumber)} onBlur={field.handleBlur}/><FieldDescription>Avtalt pakke: opptil {capacityLimit} studenter. Kontakt Navet hvis dere ønsker flere.</FieldDescription><FieldError errors={field.state.meta.errors}/></Field>}</form.Field>
   </div>
   {choice("venue","Hvor skal arrangementet være?",VENUE_CHOICES)}{text("location")}
  </section>
  <form.Subscribe selector={state=>state.values}>{values=><>
   <section className="space-y-6 border-t pt-7"><h2 className="font-bold text-[22px]">Mat og drikke</h2>
    {choice("foodAndDrinks","Ønsker dere servering av mat og drikke?",ANSWER_CHOICES)}
    {values.foodAndDrinks!=="no"&&<>{choice("foodPurchasedBy","Hvem skal ordne serveringen?",FOOD_PURCHASER_LABELS)}{text("food")}</>}
    {choice("alcohol","Skal det serveres alkohol?",ANSWER_CHOICES)}
    {choice("ageRestriction","Skal arrangementet ha 18-årsgrense?",values.venue==="escape"||values.alcohol==="yes"?{"18":AGE_CHOICES["18"]}:AGE_CHOICES,"Ved bruk av Escape eller servering av alkohol må arrangementet ha 18-årsgrense.")}
   </section>
   <section className="space-y-6 border-t pt-7"><h2 className="font-bold text-[22px]">Stand og andre ønsker</h2>
    {choice("stand","Ønsker dere stand på IFI i forkant?",ANSWER_CHOICES,"En stand er en fin mulighet til å møte flere studenter før arrangementet.")}
    {values.stand==="yes"&&text("standDetails")}{text("notes")}
   </section>
  </>}</form.Subscribe>
  {after}
  <div className="space-y-3 border-t pt-6">
   {error&&<p role="alert" className="text-destructive">{error}</p>}
   <form.Subscribe selector={state=>[state.isSubmitting,state.isValid] as const}>{([pending,valid])=><>
    {!valid&&<p role="alert" className="text-sm text-destructive">Kontroller de markerte feltene før du fortsetter.</p>}
    <Button type="submit" size="lg" disabled={pending} className="min-h-12 w-full sm:w-auto">{pending?"Lagrer …":submitLabel}</Button>
   </>}</form.Subscribe>
  </div>
 </form>;
}
