import NextLink from 'next/link';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  HStack,
  IconButton,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  Text,
  Textarea,
  Tooltip,
  VStack,
  useToast
} from '@chakra-ui/react';
import { DownloadIcon, ReloadIcon, CounterClockwiseClockIcon, UploadIcon } from '@radix-ui/react-icons';
import { useDropzone } from 'react-dropzone';
import dayjs from 'dayjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type TaskState = 'idle' | 'running' | 'success' | 'error';

type NamedFile = {
  file: File;
  addedAt: string;
};

const useFileDownloader = () => {
  const toast = useToast();
  return useCallback(
    async (promise: Promise<Response>, filename: string) => {
      try {
        const res = await promise;
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        toast({
          title: 'Download ready',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        toast({
          title: 'Action failed',
          description: message,
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
        throw error;
      }
    },
    [toast]
  );
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, index)).toFixed(1)} ${units[index]}`;
};

const FileCard = ({ file }: { file: NamedFile }) => (
  <Box borderRadius="xl" borderWidth="1px" padding={4} bg="gray.800" shadow="md">
    <HStack justify="space-between" align="flex-start">
      <VStack align="flex-start" spacing={1} maxW="70%">
        <Text fontWeight="semibold" noOfLines={1}>
          {file.file.name}
        </Text>
        <Text fontSize="sm" color="gray.400">
          {formatFileSize(file.file.size)}
        </Text>
      </VStack>
      <Tag colorScheme="teal">{dayjs(file.addedAt).format('HH:mm:ss')}</Tag>
    </HStack>
  </Box>
);

const Dropzone = ({
  onFiles,
  label,
  multiple = false,
}: {
  onFiles: (files: File[]) => void;
  label: string;
  multiple?: boolean;
}) => {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length) onFiles(accepted);
    },
    [onFiles]
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple,
    accept: { 'application/pdf': ['.pdf'] },
  });

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      border="2px dashed"
      borderColor={isDragActive ? 'teal.300' : 'gray.700'}
      borderRadius="2xl"
      bg={isDragActive ? 'rgba(56, 178, 172, 0.08)' : 'gray.900'}
      transition="border-color 0.2s ease"
      cursor="pointer"
      padding={10}
      minH="200px"
      {...getRootProps()}
    >
      <input {...getInputProps()} />
      <VStack spacing={3}>
        <IconButton
          aria-label="Upload"
          icon={<UploadIcon />}
          size="lg"
          isRound
          bg="teal.500"
          color="white"
          _hover={{ bg: 'teal.400' }}
          _active={{ bg: 'teal.600' }}
        />
        <Heading size="md" textAlign="center">
          {label}
        </Heading>
        <Text fontSize="sm" color="gray.400">
          Drag & drop or click to browse
        </Text>
      </VStack>
    </Flex>
  );
};

const ActionButton = ({
  onClick,
  label,
  isLoading,
  leftIcon,
  colorScheme = 'teal',
}: {
  onClick: () => void;
  label: string;
  isLoading: boolean;
  leftIcon?: React.ReactElement;
  colorScheme?: string;
}) => (
  <Button
    onClick={onClick}
    colorScheme={colorScheme}
    leftIcon={leftIcon}
    minW="200px"
    isLoading={isLoading}
    loadingText="Processing"
    spinner={<Spinner size="sm" />}
  >
    {label}
  </Button>
);

const SectionCard = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) => (
  <Box bg="gray.900" borderRadius="xl" borderWidth="1px" borderColor="gray.800" padding={8} shadow="xl">
    <VStack align="flex-start" spacing={6}>
      <VStack align="flex-start" spacing={1}>
        <Heading size="md">{title}</Heading>
        <Text color="gray.400">{subtitle}</Text>
      </VStack>
      {children}
    </VStack>
  </Box>
);

function PDFDashboard() {
  const toast = useToast();
  const [mergeFiles, setMergeFiles] = useState<NamedFile[]>([]);
  const [singleFile, setSingleFile] = useState<NamedFile | null>(null);
  const [imageFile, setImageFile] = useState<NamedFile | null>(null);
  const [taskState, setTaskState] = useState<Record<string, TaskState>>({});
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [reorderOrder, setReorderOrder] = useState('1-');
  const [rotateRanges, setRotateRanges] = useState('1-');
  const [rotateDegrees, setRotateDegrees] = useState(90);
  const [opacity, setOpacity] = useState(0.3);
  const [watermarkScale, setWatermarkScale] = useState(0.5);
  const [fontSize, setFontSize] = useState(48);

  const download = useFileDownloader();

  const appendFiles = useCallback((incoming: File[]) => {
    const now = dayjs().toISOString();
    setMergeFiles((prev) => [...prev, ...incoming.map((file) => ({ file, addedAt: now }))]);
  }, []);

  const setSingle = useCallback((incoming: File[]) => {
    if (!incoming.length) return;
    const [file] = incoming;
    setSingleFile({ file, addedAt: dayjs().toISOString() });
  }, []);

  const setImage = useCallback((incoming: File[]) => {
    if (!incoming.length) return;
    const [file] = incoming;
    setImageFile({ file, addedAt: dayjs().toISOString() });
  }, []);

  const buildFormData = (...entries: [string, Blob | string][]) => {
    const form = new FormData();
    entries.forEach(([key, value]) => form.append(key, value));
    return form;
  };

  const runTask = async (key: string, action: () => Promise<void>) => {
    setTaskState((prev) => ({ ...prev, [key]: 'running' }));
    try {
      await action();
      setTaskState((prev) => ({ ...prev, [key]: 'success' }));
      setTimeout(() => setTaskState((prev) => ({ ...prev, [key]: 'idle' })), 2000);
    } catch (error) {
      setTaskState((prev) => ({ ...prev, [key]: 'error' }));
      setTimeout(() => setTaskState((prev) => ({ ...prev, [key]: 'idle' })), 3000);
    }
  };

  const merge = async () => {
    if (mergeFiles.length < 2) {
      toast({
        title: 'Need at least two PDFs',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    const form = new FormData();
    mergeFiles.forEach(({ file }) => form.append('files', file));
    await download(fetch(`${API_URL}/merge`, { method: 'POST', body: form }), 'merged.pdf');
  };

  const watermarkTextAction = async () => {
    if (!singleFile) {
      toast({ title: 'Select a PDF first', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    const form = buildFormData(
      ['file', singleFile.file],
      ['text', watermarkText],
      ['opacity', opacity.toString()],
      ['rotation', '45'],
      ['font_size', fontSize.toString()]
    );
    await download(fetch(`${API_URL}/watermark/text`, { method: 'POST', body: form }), 'watermarked-text.pdf');
  };

  const watermarkImageAction = async () => {
    if (!singleFile || !imageFile) {
      toast({
        title: 'Select a PDF and image',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    const form = buildFormData(
      ['pdf_file', singleFile.file],
      ['image_file', imageFile.file],
      ['opacity', opacity.toString()],
      ['scale', watermarkScale.toString()]
    );
    await download(fetch(`${API_URL}/watermark/image`, { method: 'POST', body: form }), 'watermarked-image.pdf');
  };

  const reorder = async () => {
    if (!singleFile) {
      toast({ title: 'Select a PDF first', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    const form = buildFormData(['file', singleFile.file], ['order', reorderOrder]);
    await download(fetch(`${API_URL}/reorder`, { method: 'POST', body: form }), 'reordered.pdf');
  };

  const rotate = async () => {
    if (!singleFile) {
      toast({ title: 'Select a PDF first', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    const form = buildFormData(
      ['file', singleFile.file],
      ['ranges', rotateRanges],
      ['degrees', rotateDegrees.toString()]
    );
    await download(fetch(`${API_URL}/rotate`, { method: 'POST', body: form }), 'rotated.pdf');
  };

  const split = async () => {
    if (!singleFile) {
      toast({ title: 'Select a PDF first', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    const form = buildFormData(['file', singleFile.file], ['ranges', reorderOrder]);
    await download(fetch(`${API_URL}/split`, { method: 'POST', body: form }), 'parts.zip');
  };

  const protect = async (password: string) => {
    if (!singleFile) {
      toast({ title: 'Select a PDF first', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    const form = buildFormData(['file', singleFile.file], ['password', password]);
    await download(fetch(`${API_URL}/protect`, { method: 'POST', body: form }), 'protected.pdf');
  };

  const unlock = async (password: string) => {
    if (!singleFile) {
      toast({ title: 'Select a PDF first', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    const form = buildFormData(['file', singleFile.file], ['password', password]);
    await download(fetch(`${API_URL}/unlock`, { method: 'POST', body: form }), 'unlocked.pdf');
  };

  const stripMetadata = async () => {
    if (!singleFile) {
      toast({ title: 'Select a PDF first', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    const form = buildFormData(['file', singleFile.file]);
    await download(fetch(`${API_URL}/metadata/strip`, { method: 'POST', body: form }), 'scrubbed.pdf');
  };

  const actionStates = useMemo(
    () => ({
      merge: taskState.merge === 'running',
      watermarkText: taskState.watermarkText === 'running',
      watermarkImage: taskState.watermarkImage === 'running',
      reorder: taskState.reorder === 'running',
      rotate: taskState.rotate === 'running',
      split: taskState.split === 'running',
    }),
    [taskState]
  );

  return (
    <Container maxW="7xl" py={12} color="gray.100">
      <VStack align="flex-start" spacing={12}>
        <Flex w="full" justify="space-between" align="center">
          <VStack align="flex-start" spacing={3}>
            <Heading size="2xl">DarkPDF Control Center</Heading>
            <Text fontSize="lg" color="gray.300">
              Modern toolkit for merging, splitting, securing, watermarking, and arranging your PDFs.
            </Text>
          </VStack>
          <Button as={NextLink} href="/editor" colorScheme="teal" variant="solid">
            Launch Live Editor
          </Button>
        </Flex>

        <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={8} alignItems="stretch">
          <GridItem>
            <SectionCard title="Workspace" subtitle="Organize inputs for bulk operations.">
              <Stack spacing={8}>
                <Box>
                  <Heading size="sm" textTransform="uppercase" letterSpacing="wide" mb={3} color="gray.400">
                    Merge queue
                  </Heading>
                  <Dropzone label="Upload PDFs for merging" onFiles={appendFiles} multiple />
                  {mergeFiles.length > 0 && (
                    <Stack mt={4} spacing={3} maxH="280px" overflowY="auto">
                      {mergeFiles.map((file, index) => (
                        <FileCard key={`${file.file.name}-${index}`} file={file} />
                      ))}
                    </Stack>
                  )}
                  <HStack justify="flex-end" mt={4} spacing={3}>
                    <Tooltip label="Clear merge queue">
                      <IconButton
                        aria-label="Clear queue"
                        icon={<CounterClockwiseClockIcon />}
                        onClick={() => setMergeFiles([])}
                      />
                    </Tooltip>
                    <ActionButton
                      onClick={() => runTask('merge', merge)}
                      label="Merge PDFs"
                      isLoading={actionStates.merge}
                      leftIcon={<ReloadIcon />}
                    />
                  </HStack>
                </Box>

                <Box>
                  <Heading size="sm" textTransform="uppercase" letterSpacing="wide" mb={3} color="gray.400">
                    Single PDF workspace
                  </Heading>
                  <Dropzone label="Upload a PDF to transform" onFiles={setSingle} />
                  {singleFile && <FileCard file={singleFile} />}
                </Box>

                <Box>
                  <Heading size="sm" textTransform="uppercase" letterSpacing="wide" mb={3} color="gray.400">
                    Watermark image (PNG/JPG)
                  </Heading>
                  <Dropzone label="Upload watermark image" multiple={false} onFiles={setImage} />
                  {imageFile && <FileCard file={imageFile} />}
                </Box>
              </Stack>
            </SectionCard>
          </GridItem>

          <GridItem>
            <SectionCard title="Live Settings" subtitle="Tune outputs in real-time.">
              <Tabs variant="soft-rounded" colorScheme="teal">
                <TabList>
                  <Tab>Watermark</Tab>
                  <Tab>Arrange</Tab>
                  <Tab>Security</Tab>
                </TabList>
                <TabPanels mt={4}>
                  <TabPanel>
                    <Stack spacing={5}>
                      <FormControl>
                        <FormLabel>Watermark text</FormLabel>
                        <Input value={watermarkText} onChange={(event) => setWatermarkText(event.target.value)} />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Font size</FormLabel>
                        <NumberInput min={12} max={120} value={fontSize} onChange={(_, value) => setFontSize(value)}>
                          <NumberInputField />
                        </NumberInput>
                      </FormControl>
                      <FormControl>
                        <FormLabel>Opacity</FormLabel>
                        <NumberInput min={0.1} max={0.9} step={0.1} value={opacity} onChange={(_, value) => setOpacity(value)}>
                          <NumberInputField />
                        </NumberInput>
                      </FormControl>
                      <FormControl>
                        <FormLabel>Image scale</FormLabel>
                        <NumberInput
                          min={0.1}
                          max={1}
                          step={0.1}
                          value={watermarkScale}
                          onChange={(_, value) => setWatermarkScale(value)}
                        >
                          <NumberInputField />
                        </NumberInput>
                      </FormControl>
                      <HStack justify="flex-end" spacing={3}>
                        <ActionButton
                          onClick={() => runTask('watermarkText', watermarkTextAction)}
                          label="Apply text watermark"
                          isLoading={actionStates.watermarkText}
                          leftIcon={<DownloadIcon />}
                        />
                        <ActionButton
                          onClick={() => runTask('watermarkImage', watermarkImageAction)}
                          label="Apply image watermark"
                          isLoading={actionStates.watermarkImage}
                          leftIcon={<DownloadIcon />}
                        />
                      </HStack>
                    </Stack>
                  </TabPanel>

                  <TabPanel>
                    <Stack spacing={5}>
                      <FormControl>
                        <FormLabel>Reorder sequence</FormLabel>
                        <Textarea
                          value={reorderOrder}
                          onChange={(event) => setReorderOrder(event.target.value)}
                          placeholder="Examples: 3,1,2,4- or 1-3,5"
                          rows={3}
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Rotate ranges</FormLabel>
                        <Input value={rotateRanges} onChange={(event) => setRotateRanges(event.target.value)} />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Rotate degrees</FormLabel>
                        <Select value={rotateDegrees} onChange={(event) => setRotateDegrees(Number(event.target.value))}>
                          <option value={90}>90° clockwise</option>
                          <option value={180}>180° flip</option>
                          <option value={270}>270°</option>
                        </Select>
                      </FormControl>
                      <HStack justify="flex-end" spacing={3}>
                        <ActionButton
                          onClick={() => runTask('reorder', reorder)}
                          label="Reorder pages"
                          isLoading={actionStates.reorder}
                          leftIcon={<DownloadIcon />}
                        />
                        <ActionButton
                          onClick={() => runTask('rotate', rotate)}
                          label="Rotate pages"
                          isLoading={actionStates.rotate}
                          leftIcon={<DownloadIcon />}
                        />
                      </HStack>
                    </Stack>
                  </TabPanel>

                  <TabPanel>
                    <Stack spacing={5}>
                      <FormControl>
                        <FormLabel>Password</FormLabel>
                        <Input type="password" placeholder="Enter password" id="password-input" />
                      </FormControl>
                      <HStack justify="flex-end" spacing={3}>
                        <Button
                          colorScheme="teal"
                          variant="outline"
                          onClick={() => {
                            const input = document.getElementById('password-input') as HTMLInputElement | null;
                            if (input) runTask('unlock', () => unlock(input.value));
                          }}
                        >
                          Unlock PDF
                        </Button>
                        <Button
                          colorScheme="teal"
                          onClick={() => {
                            const input = document.getElementById('password-input') as HTMLInputElement | null;
                            if (input) runTask('protect', () => protect(input.value));
                          }}
                        >
                          Protect PDF
                        </Button>
                      </HStack>
                      <ActionButton
                        onClick={() => runTask('split', split)}
                        label="Split into parts"
                        isLoading={actionStates.split}
                        leftIcon={<DownloadIcon />}
                      />
                      <Button variant="ghost" colorScheme="teal" onClick={() => runTask('metadata', stripMetadata)}>
                        Strip metadata
                      </Button>
                    </Stack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </SectionCard>
          </GridItem>
        </Grid>
      </VStack>
    </Container>
  );
}

export default function Home() {
  return (
    <Box minH="100vh" py={12}>
      <PDFDashboard />
    </Box>
  );
}


