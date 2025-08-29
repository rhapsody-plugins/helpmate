import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useDataSource } from '@/hooks/useDataSource';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useConsent } from '@/contexts/ConsentContext';

const formSchema = z.object({
  title: z.string(),
  content: z.string().min(1, 'Content is required'),
});

type FormData = z.infer<typeof formSchema>;

export default function TabText() {
  const { requestConsent } = useConsent();
  const { getSourcesMutation, addSourceMutation, updateSourceMutation } =
    useDataSource();

  const {
    data: fetchData,
    isPending: isFetching,
    mutate: fetchMutate,
  } = getSourcesMutation;

  const { isPending: addIsPending, mutate: addMutate } = addSourceMutation;

  const { isPending: updateIsPending, mutate: updateMutate } =
    updateSourceMutation;

  const form = useForm<FormData>({
    defaultValues: {
      title: 'Text context from the website/user',
      content: '',
    },
    resolver: zodResolver(formSchema),
  });

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │   Handlers                                                                  │
  └─────────────────────────────────────────────────────────────────────────────┘
 */

  // Initial data fetch
  useEffect(() => {
    fetchMutate('text', {
      onSuccess: (data) => {
        if (data.length > 0) {
          form.reset({
            title: data[0].title,
            content: data[0].content,
          });
        }
      },
    });
  }, [fetchMutate, form]);

  const handleSubmit = useCallback(
    (data: FormData) => {
      if (fetchData?.[0]?.id) {
        updateMutate(
          {
            id: fetchData[0].id,
            document_type: 'text',
            title: data.title,
            content: data.content,
            vector: fetchData[0].vector,
            metadata: {},
            last_updated: Math.floor(Date.now() / 1000),
          },
          {
            onSuccess: () => {
              form.reset({
                title: data.title,
                content: data.content,
              });
            },
            onError: (error) => {
              // If consent is required, request it through the context
              if (error.message === 'CONSENT_REQUIRED') {
                requestConsent(() => handleSubmit(data));
              }
            },
          }
        );
      } else {
        addMutate(
          {
            document_type: 'text',
            title: data.title,
            content: data.content,
            metadata: {},
          },
          {
            onSuccess: () => {
              form.reset({
                title: data.title,
                content: data.content,
              });
            },
            onError: (error) => {
              // If consent is required, request it through the context
              if (error.message === 'CONSENT_REQUIRED') {
                requestConsent(() => handleSubmit(data));
              }
            },
          }
        );
      }
    },
    [addMutate, fetchData, updateMutate, form]
  );

  /*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │   Renders                                                                   │
  └─────────────────────────────────────────────────────────────────────────────┘
 */

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex gap-1 items-center text-xl font-bold">
            Text Source{' '}
            <InfoTooltip message="Add a text source to your Helpmate." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              {isFetching ? (
                <div className="flex flex-col gap-4">
                  <Skeleton className="w-20 h-5" />
                  <Skeleton className="w-full h-24" />
                </div>
              ) : (
                <>
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Content</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Enter text" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    disabled={addIsPending || updateIsPending}
                    loading={addIsPending || updateIsPending}
                    type="submit"
                  >
                    {addIsPending || updateIsPending ? 'Saving...' : 'Save'}
                  </Button>
                </>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
