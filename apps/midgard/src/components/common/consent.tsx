"use client";

import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import posthog from "posthog-js";
import { useEffect, useState } from "react";

export function cookieConsentGiven() {
	if (!localStorage.getItem("cookie_consent")) {
		return "undecided";
	}
	return localStorage.getItem("cookie_consent");
}

export function Consent() {
	const [consentGiven, setConsentGiven] = useState("");

	useEffect(() => {
		const consent = cookieConsentGiven();
		setConsentGiven(consent || "undecided");
	}, []);

	useEffect(() => {
		if (consentGiven !== "") {
			posthog.set_config({
				persistence: consentGiven === "yes" ? "localStorage+cookie" : "memory",
			});
		}
	}, [consentGiven]);

	const handleAcceptCookies = () => {
		localStorage.setItem("cookie_consent", "yes");
		setConsentGiven("yes");
	};

	const handleDeclineCookies = () => {
		localStorage.setItem("cookie_consent", "no");
		setConsentGiven("no");
	};

	return (
		consentGiven === "undecided" && (
			<div className={`fixed right-0 bottom-2 left-0 z-50 px-2 md:bottom-6 md:px-6`}>
				<Card className='max-h-[90svh] w-full max-w-xl overflow-y-auto text-pretty break-words border-primary shadow-lg'>
					<CardHeader>
						<CardTitle>Hjelp oss med å gjøre ifinavet.no best mulig</CardTitle>
						<CardDescription>
							Vi bruker informasjonskapsler (cookies) til å forbedre og forstå hvordan nettsiden vår
							brukes.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className='text-sm'>
							Venligst godta bruk av informasjonskapsler, vi bruker kunn infromasjonen lokalt, og
							deler den aldri med noen tredjeparter
						</p>
					</CardContent>
					<CardFooter className='flex flex-wrap gap-4'>
						<Button onClick={handleAcceptCookies}>Godta bruk av cookies</Button>
						<Button onClick={handleDeclineCookies} variant='secondary'>
							Avslå bruk av cookies
						</Button>
					</CardFooter>
				</Card>
			</div>
		)
	);
}
