import dynamic from 'next/dynamic';

import Head from 'next/head';

import { useCallback, useEffect, useMemo, useRef, useState, Component, ReactNode } from 'react';

import NextLink from 'next/link';

import {

  Box,

  Button,

  Container,

  Flex,

  Grid,

  GridItem,

  HStack,

  Heading,

  IconButton,

  Stack,

  Stat,

  StatLabel,

  StatNumber,

  Text,

  Tooltip,

  useToast,

  VStack,

  Divider,

  Badge,

  chakra,

  Alert,

  AlertIcon,

  AlertTitle,

  AlertDescription,

  CloseButton,

} from '@chakra-ui/react';

import { highlightPlugin, HighlightArea, Trigger, type HighlightPlugin } from '@react-pdf-viewer/highlight';

import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';

import { useDropzone } from 'react-dropzone';

import dayjs from 'dayjs';



const Viewer = dynamic(() => import('@react-pdf-viewer/core').then((mod) => mod.Viewer), { ssr: false });

const Worker = dynamic(() => import('@react-pdf-viewer/core').then((mod) => mod.Worker), { ssr: false });



const workerUrl = '/pdf.worker.min.js';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Send errors to API for terminal logging
const reportError = async (error: Error, component?: string) => {
  try {
    await fetch(`${API_URL}/log/error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        component: component || 'Editor',
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    // Silently fail if error reporting fails
    console.warn('Failed to report error to API:', e);
  }
};

// Error boundary to catch PDF viewer crashes

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error) => void;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class PdfErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('PDF Viewer Error:', error);
    reportError(error, 'PdfErrorBoundary');
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Flex direction="column" align="center" justify="center" minH="400px" p={8}>
          <Alert status="error" variant="subtle" flexDirection="column" alignItems="center" justifyContent="center" textAlign="center" borderRadius="xl" py={8}>
            <AlertIcon boxSize="40px" mr={0} />
            <AlertTitle mt={4} mb={1} fontSize="lg">PDF Viewer Error</AlertTitle>
            <AlertDescription maxWidth="sm">
              There was an issue displaying this PDF. This may happen with image-only PDFs that don&apos;t contain text layers.
            </AlertDescription>
            <Button mt={4} colorScheme="red" variant="outline" onClick={() => this.setState({ hasError: false, error: null })}>
              Try Again
            </Button>
          </Alert>
        </Flex>
      );
    }
    return this.props.children;
  }
}



const Dropzone = ({ onFile }: { onFile: (files: File[]) => void }) => {

  const onDrop = useCallback(

    (accepted: File[]) => {

      if (accepted.length > 0) onFile(accepted);

    },

    [onFile]

  );



  const { getRootProps, getInputProps, isDragActive } = useDropzone({

    onDrop,

    multiple: false,

    accept: { 'application/pdf': ['.pdf'] },

  });



  return (

    <Flex

      border="2px dashed"

      borderColor={isDragActive ? 'teal.300' : 'gray.700'}

      borderRadius="2xl"

      bg={isDragActive ? 'rgba(56, 178, 172, 0.08)' : 'gray.900'}

      direction="column"

      align="center"

      justify="center"

      cursor="pointer"

      minH="240px"

      px={10}

      py={12}

      transition="all 0.2s ease"

      {...getRootProps()}

    >

      <input {...getInputProps()} />

      <Heading size="md" mb={3} textAlign="center">

        Drop a PDF or click to upload

      </Heading>

      <Text color="gray.400" textAlign="center">

        Supports drag-and-drop. Once loaded, select any text to highlight and annotate.

      </Text>

    </Flex>

  );

};



const HighlightBadge = chakra(Badge);



type HighlightRecord = HighlightArea & { id: string };



export default function Editor() {

  const toast = useToast();

  const [file, setFile] = useState<File | null>(null);

  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const [highlights, setHighlights] = useState<HighlightRecord[]>([]);

  const highlightsRef = useRef<HighlightRecord[]>([]);

  const urlRef = useRef<string | null>(null);

  const [isHighlightMode, setIsHighlightMode] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const [isImagePdf, setIsImagePdf] = useState(false);

  const [viewerError, setViewerError] = useState<string | null>(null);



  useEffect(() => {

    highlightsRef.current = highlights;

  }, [highlights]);

  // Global error handler to catch unhandled errors and send to API terminal
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const error = new Error(event.message);
      error.stack = `at ${event.filename}:${event.lineno}:${event.colno}`;
      reportError(error, 'GlobalErrorHandler');
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));
      reportError(error, 'UnhandledPromiseRejection');
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);



  useEffect(() => {

    if (viewerUrl && urlRef.current && viewerUrl !== urlRef.current) {

      URL.revokeObjectURL(urlRef.current);

    }

    if (viewerUrl) {

      urlRef.current = viewerUrl;

    }

    return () => {

      if (urlRef.current) {

        URL.revokeObjectURL(urlRef.current);

        urlRef.current = null;

      }

    };

  }, [viewerUrl]);



  const addHighlight = useCallback((areas: HighlightArea[] | undefined) => {
    if (!Array.isArray(areas) || areas.length === 0) return;

    const stamp = dayjs().valueOf();

    setHighlights((prev) => [

      ...prev,

      ...areas.map((area, index) => ({ ...area, id: `${stamp}-${index}` })),

    ]);

  }, []);



  const clearHighlights = useCallback(() => {

    setHighlights([]);

  }, []);



  const highlightPluginInstance = useMemo<HighlightPlugin>(() => {
    return highlightPlugin({

      renderHighlightTarget: (props) => (

        <VStack spacing={2} bg="gray.900" padding={4} borderRadius="md" borderWidth="1px" borderColor="gray.700" shadow="lg">

          <Text fontWeight="semibold">Add highlight?</Text>

          <HStack spacing={2}>

            <Button

              size="sm"

              colorScheme="yellow"

              onClick={() => {

                addHighlight(props.highlightAreas);

                props.cancel();

              }}

            >

              Highlight

            </Button>

            <Button size="sm" variant="ghost" onClick={props.cancel}>

              Cancel

            </Button>

          </HStack>

        </VStack>

      ),

      renderHighlights: (props) => (

        <>

          {highlightsRef.current

            .filter((highlight) => highlight.pageIndex === props.pageIndex)

            .map((highlight) => (

              <div

                key={highlight.id}

                style={{

                  ...props.getCssProperties(highlight, props.rotation),

                  background: 'rgba(255, 226, 62, 0.45)',

                  borderRadius: '4px',

                }}

              />

            ))}

        </>

      ),

      trigger: Trigger.None,

    });

  }, [addHighlight]);



  const defaultLayoutPluginInstance = useMemo(() => defaultLayoutPlugin(), []);



  const viewerPlugins = useMemo(() => {

    if (highlightPluginInstance) {

      return [defaultLayoutPluginInstance, highlightPluginInstance];

    }

    return [defaultLayoutPluginInstance];

  }, [defaultLayoutPluginInstance, highlightPluginInstance]);







  useEffect(() => {
    // Don't enable text selection trigger for image-only PDFs
    const trigger = (isImagePdf || !isHighlightMode) ? Trigger.None : Trigger.TextSelection;
    highlightPluginInstance.switchTrigger(trigger);
  }, [highlightPluginInstance, isHighlightMode, isImagePdf]);



  const handleFiles = useCallback(async (files: File[]) => {

    if (!files.length) return;

    const [uploaded] = files;

    setFile(uploaded);

    setViewerError(null);

    setIsImagePdf(false);

    const url = URL.createObjectURL(uploaded);

    setViewerUrl(url);

    setHighlights([]);

    // Check if PDF has text content (to detect image-only PDFs)
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
      const arrayBuffer = await uploaded.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let hasText = false;
      // Check first few pages for text content
      const pagesToCheck = Math.min(pdf.numPages, 3);
      for (let i = 1; i <= pagesToCheck && !hasText; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        if (textContent.items.length > 0) {
          hasText = true;
        }
      }
      setIsImagePdf(!hasText);
      if (!hasText) {
        toast({
          title: 'Image-only PDF detected',
          description: 'This PDF contains only images without text. Text highlighting will not work, but you can still view and download it.',
          status: 'info',
          duration: 6000,
          isClosable: true
        });
      }
    } catch (err) {
      console.warn('Could not analyze PDF text content:', err);
    }

  }, [toast]);



  const handleApplyHighlights = useCallback(async () => {

    if (!file) {

      toast({ title: 'Upload a PDF first', status: 'warning', duration: 3000, isClosable: true });

      return;

    }

    if (!highlights.length) {

      toast({ title: 'No highlights to apply', status: 'info', duration: 3000, isClosable: true });

      return;

    }



    setIsSaving(true);

    try {

      const payload = highlights.map(({ id, ...rest }) => rest);

      const form = new FormData();

      form.append('file', file);

      form.append('highlights', JSON.stringify(payload));

      const res = await fetch(`${API_URL}/annotate/highlight`, { method: 'POST', body: form });

      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();

      const suggestedName = file.name.replace(/\.pdf$/i, '') + '-highlighted.pdf';

      const updatedFile = new File([blob], suggestedName, { type: 'application/pdf' });

      setFile(updatedFile);

      const newUrl = URL.createObjectURL(blob);

      setViewerUrl(newUrl);

      setHighlights([]);

      toast({ title: 'Highlights embedded', status: 'success', duration: 3000, isClosable: true });

      const link = document.createElement('a');

      link.href = newUrl;

      link.download = suggestedName;

      document.body.appendChild(link);

      link.click();

      link.remove();

    } catch (error) {

      const message = error instanceof Error ? error.message : 'Unexpected error';

      toast({ title: 'Failed to apply highlight', description: message, status: 'error', duration: 4000, isClosable: true });

    } finally {

      setIsSaving(false);

    }

  }, [file, highlights, toast]);



  return (

    <Box minH="100vh">

      <Head>

        <title>DarkPDF Live Editor</title>

      </Head>

      <Box borderBottomWidth="1px" borderColor="gray.800" bg="rgba(12, 15, 22, 0.92)" backdropFilter="blur(8px)" position="sticky" top={0} zIndex={100}>

        <Container maxW="7xl" py={4}>

          <HStack justify="space-between" spacing={8}>

            <HStack spacing={4}>

              <Heading size="lg">DarkPDF</Heading>

              <Badge colorScheme="purple" borderRadius="md" px={3} py={1} fontSize="sm">

                Editor Preview

              </Badge>

            </HStack>

            <HStack spacing={6} color="gray.300" fontWeight="medium">

              <Text as="span">Files</Text>

              <Text as="span" color="teal.300">

                Edit

              </Text>

              <Text as="span">Annotate</Text>

              <Text as="span">Share</Text>

            </HStack>

            <HStack spacing={3}>

              <Button variant="ghost" as={NextLink} href="/">

                Back to Toolkit

              </Button>

              <Tooltip label={isImagePdf ? 'Highlighting is not available for image-only PDFs' : ''} isDisabled={!isImagePdf}>

                <Button
                  colorScheme="teal"
                  onClick={() => setIsHighlightMode((prev) => !prev)}
                  isDisabled={isImagePdf}
                  opacity={isImagePdf ? 0.5 : 1}
                >

                  {isHighlightMode ? 'Exit Highlight Mode' : 'Highlight Text'}

                </Button>

              </Tooltip>

            </HStack>

          </HStack>

        </Container>

      </Box>



      <Container maxW="7xl" py={10}>

        <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={8} alignItems="start">

          <GridItem>

            {!viewerUrl ? (

              <Dropzone onFile={handleFiles} />

            ) : (

              <Box borderRadius="2xl" borderWidth="1px" borderColor="gray.800" overflow="hidden" bg="blackAlpha.300">

                <PdfErrorBoundary onError={(err) => setViewerError(err.message)}>

                  <Worker workerUrl={workerUrl}>

                    <Box height={{ base: '80vh', xl: '82vh' }}>

                      <Viewer fileUrl={viewerUrl} plugins={viewerPlugins} />

                    </Box>

                  </Worker>

                </PdfErrorBoundary>

              </Box>

            )}

          </GridItem>



          <GridItem>

            <VStack align="stretch" spacing={8}>

              <Box bg="gray.900" borderRadius="xl" borderWidth="1px" borderColor="gray.800" p={6} shadow="xl">

                <VStack align="flex-start" spacing={4}>

                  <Heading size="md">Session overview</Heading>

                  {file ? (

                    <>

                      <Text color="gray.300">{file.name}</Text>

                      {isImagePdf && (

                        <Alert status="warning" variant="subtle" borderRadius="md" size="sm">

                          <AlertIcon />

                          <Box>

                            <AlertTitle fontSize="sm">Image-only PDF</AlertTitle>

                            <AlertDescription fontSize="xs">

                              This PDF contains no text layer. Text highlighting is disabled.

                            </AlertDescription>

                          </Box>

                        </Alert>

                      )}

                      <Stat>

                        <StatLabel color="gray.400">Active highlights</StatLabel>

                        <StatNumber>{highlights.length}</StatNumber>

                      </Stat>

                      <HStack spacing={3}>

                        <Button colorScheme="yellow" isLoading={isSaving} onClick={handleApplyHighlights} loadingText="Embedding">

                          Apply & Download

                        </Button>

                        <Tooltip label="Remove highlights from the current preview">

                          <IconButton

                            aria-label="Clear highlights"

                            icon={<span>✕</span>}

                            onClick={clearHighlights}

                            variant="outline"

                          />

                        </Tooltip>

                      </HStack>

                    </>

                  ) : (

                    <Text color="gray.400">Upload a document to begin editing.</Text>

                  )}

                  <Divider borderColor="gray.700" />

                  <Text fontSize="sm" color="gray.400">

                    Highlight mode lets you drag across text to mark important phrases. Once satisfied, click “Apply & Download” to bake the highlights directly into the PDF just like LightPDF—and better.

                  </Text>

                </VStack>

              </Box>



              {highlights.length > 0 && (

                <Box bg="gray.900" borderRadius="xl" borderWidth="1px" borderColor="gray.800" p={6} shadow="lg">

                  <Heading size="sm" textTransform="uppercase" letterSpacing="wide" mb={4} color="gray.400">

                    Highlights in this session

                  </Heading>

                  <VStack align="stretch" spacing={3} maxH="260px" overflowY="auto">

                    {highlights.map((highlight) => (

                      <Flex key={highlight.id} justify="space-between" align="center" bg="blackAlpha.400" borderRadius="md" px={4} py={3}>

                        <VStack align="flex-start" spacing={1}>

                          <Text fontWeight="medium">Page {highlight.pageIndex + 1}</Text>

                          <Text fontSize="sm" color="gray.400">

                            Left {(highlight.left * 100).toFixed(1)}% · Top {(highlight.top * 100).toFixed(1)}%

                          </Text>

                        </VStack>

                        <HighlightBadge colorScheme="yellow">Queued</HighlightBadge>

                      </Flex>

                    ))}

                  </VStack>

                </Box>

              )}

            </VStack>

          </GridItem>

        </Grid>

      </Container>

    </Box>

  );

}









