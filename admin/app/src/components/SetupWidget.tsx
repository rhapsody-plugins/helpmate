import { __ } from '@/lib/utils';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import Step1ApiKey from '@/components/setup/Step1ApiKey';
import Step1bLocalhostMigration from '@/components/setup/Step1bLocalhostMigration';
import Step2OpenAI from '@/components/setup/Step2OpenAI';
import Step3DataTraining from '@/components/setup/Step3DataTraining';
import { CheckCircle2 } from 'lucide-react';
import { PageType } from '@/contexts/MainContext';
import {
  shouldShowLocalhostMigrationStep,
  useLocalhostMigration,
} from '@/hooks/useLocalhostMigration';

function getInitialStepFromUrl(): {
  step: number;
  step1Complete: boolean;
  step1bComplete: boolean;
  step2Complete: boolean;
} {
  const stepParam = new URLSearchParams(window.location.search).get('step');
  const step = stepParam ? parseInt(stepParam, 10) : 1;
  const validStep = step >= 1 && step <= 4 ? step : 1;
  return {
    step: validStep,
    step1Complete: validStep >= 2,
    step1bComplete: validStep >= 3,
    step2Complete: validStep >= 4,
  };
}

export default function SetupWidget({
  setPage,
}: {
  setPage: (page: PageType) => void;
}) {
  const initial = getInitialStepFromUrl();
  const [currentStep, setCurrentStep] = useState(initial.step);
  const [step1Complete, setStep1Complete] = useState(initial.step1Complete);
  const [step1bComplete, setStep1bComplete] = useState(initial.step1bComplete);
  const [step2Complete, setStep2Complete] = useState(initial.step2Complete);
  const [step3Complete, setStep3Complete] = useState(false);
  const { sourcesQuery } = useLocalhostMigration();
  const migrationPayload = sourcesQuery.data;
  const shouldShowMigrationStep =
    shouldShowLocalhostMigrationStep(migrationPayload);
  const targetDomain = migrationPayload?.target_domain ?? '';

  const handleStep1Complete = async () => {
    setStep1Complete(true);
    const { data: payload } = await sourcesQuery.refetch();
    setCurrentStep(shouldShowLocalhostMigrationStep(payload) ? 2 : 3);
  };

  const handleStep1bComplete = () => {
    setStep1bComplete(true);
    setCurrentStep(3);
  };

  const handleStep1bSkip = () => {
    setStep1bComplete(true);
    setCurrentStep(3);
  };

  const handleStep2Complete = () => {
    setStep2Complete(true);
    setCurrentStep(4);
  };

  const handleStep2Skip = () => {
    setStep2Complete(true);
    setCurrentStep(4);
  };

  const handleStep3Complete = () => {
    setStep3Complete(true);
  };

  const handleStep3Skip = () => {
    setStep3Complete(true);
    // Redirect to test chatbot page after skipping
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'test-chatbot');
    window.history.pushState({}, '', url.toString());
    setPage('test-chatbot');
  };

  return (
    <Card className="shadow-xl">
      <CardContent className="p-8">
        {/* Step Indicators */}
        <div className="mb-12">
          <div className="flex relative justify-between items-center">
            {/* Connecting Lines Background */}
            <div className="absolute top-5 left-[20px] right-[20px] h-0.5 bg-gray-200">
              <div
                className={`h-full bg-primary transition-all duration-300 ${
                  currentStep >= 4
                    ? 'w-full'
                    : currentStep >= 3
                    ? 'w-2/3'
                    : currentStep >= 2
                    ? 'w-1/3'
                    : 'w-0'
                }`}
              />
            </div>

            {/* Step 1 */}
            <div className="flex relative z-10 flex-col flex-1 justify-center items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                  currentStep >= 1
                    ? 'bg-primary text-white border-primary shadow-md'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {step1Complete ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-semibold">1</span>
                )}
              </div>
              <p
                className={`mt-3 text-sm font-medium ${
                  currentStep >= 1 ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                {__('API Key Setup')}
              </p>
            </div>

            {/* Step 1.5 */}
            <div className="flex relative z-10 flex-col flex-1 justify-center items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                  currentStep >= 2
                    ? 'bg-primary text-white border-primary shadow-md'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {step1bComplete ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-semibold">2</span>
                )}
              </div>
              <p
                className={`mt-3 text-sm font-medium ${
                  currentStep >= 2 ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                {__('Import saved data')}
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex relative z-10 flex-col flex-1 justify-center items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                  currentStep >= 3
                    ? 'bg-primary text-white border-primary shadow-md'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {step2Complete ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-semibold">3</span>
                )}
              </div>
              <p
                className={`mt-3 text-sm font-medium ${
                  currentStep >= 3 ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                {__('OpenAI Key (Optional)')}
              </p>
            </div>

            {/* Step 4 */}
            <div className="flex relative z-10 flex-col flex-1 justify-center items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                  currentStep >= 4
                    ? 'bg-primary text-white border-primary shadow-md'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {step3Complete ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-semibold">4</span>
                )}
              </div>
              <p
                className={`mt-3 text-sm font-medium ${
                  currentStep >= 4 ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                {__('Data Training (Optional)')}
              </p>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {currentStep === 1 && (
            <Step1ApiKey onComplete={handleStep1Complete} />
          )}
          {currentStep === 2 && shouldShowMigrationStep && (
            <Step1bLocalhostMigration
              targetDomain={targetDomain}
              onComplete={handleStep1bComplete}
              onSkip={handleStep1bSkip}
            />
          )}
          {currentStep === 3 && (
            <Step2OpenAI
              onComplete={handleStep2Complete}
              onSkip={handleStep2Skip}
            />
          )}
          {currentStep === 4 && (
            <Step3DataTraining
              onComplete={handleStep3Complete}
              onSkip={handleStep3Skip}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
