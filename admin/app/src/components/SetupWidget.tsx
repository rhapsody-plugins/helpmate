import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import Step1ApiKey from '@/components/setup/Step1ApiKey';
import Step2OpenAI from '@/components/setup/Step2OpenAI';
import Step3DataTraining from '@/components/setup/Step3DataTraining';
import { CheckCircle2 } from 'lucide-react';
import { PageType } from '@/contexts/MainContext';

export default function SetupWidget({
  setPage,
}: {
  setPage: (page: PageType) => void;
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [step1Complete, setStep1Complete] = useState(false);
  const [step2Complete, setStep2Complete] = useState(false);
  const [step3Complete, setStep3Complete] = useState(false);

  const handleStep1Complete = () => {
    setStep1Complete(true);
    setCurrentStep(2);
  };

  const handleStep2Complete = () => {
    setStep2Complete(true);
    setCurrentStep(3);
  };

  const handleStep2Skip = () => {
    setStep2Complete(true);
    setCurrentStep(3);
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
                  currentStep >= 3
                    ? 'w-full'
                    : currentStep >= 2
                    ? 'w-1/2'
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
                API Key Setup
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex relative z-10 flex-col flex-1 justify-center items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                  currentStep >= 2
                    ? 'bg-primary text-white border-primary shadow-md'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {step2Complete ? (
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
                OpenAI Key (Optional)
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
                {step3Complete ? (
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
                Data Training (Optional)
              </p>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {currentStep === 1 && (
            <Step1ApiKey onComplete={handleStep1Complete} />
          )}
          {currentStep === 2 && (
            <Step2OpenAI
              onComplete={handleStep2Complete}
              onSkip={handleStep2Skip}
            />
          )}
          {currentStep === 3 && (
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
