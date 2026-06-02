/**
 * 语音合成页面
 * 路由: /c/tts
 */

"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  Card,
  Select,
  Input,
  Button,
  Space,
  message,
  Row,
  Col,
  Tag,
  Tooltip,
  Spin,
} from "antd";
import {
  SoundOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  ExperimentOutlined,
} from "@ant-design/icons";
import axios from "@/lib/axios";
import { useAuth } from "@/contexts/AuthContext";
import { TTS_VIEW } from "@/constants/permissions";
import { useRouter } from "next/navigation";

const { TextArea } = Input;

/**
 * 模型定义
 */
interface ModelOption {
  id: string;
  name: string;
  description: string;
  voices: VoiceOption[];
}

interface VoiceOption {
  id: string;
  name: string;
  lang: string;
  gender: string;
}

/**
 * 预设模型列表
 */
const MODELS: ModelOption[] = [
  {
    id: "mimo-v2.5-tts",
    name: "MiMo-V2.5-TTS",
    description: "内置高质量音色",
    voices: [
      { id: "冰糖", name: "冰糖", lang: "中文", gender: "女" },
      { id: "茉莉", name: "茉莉", lang: "中文", gender: "女" },
      { id: "苏打", name: "苏打", lang: "中文", gender: "男" },
      { id: "白桦", name: "白桦", lang: "中文", gender: "男" },
      { id: "Mia", name: "Mia", lang: "英文", gender: "女" },
      { id: "Chloe", name: "Chloe", lang: "英文", gender: "女" },
      { id: "Milo", name: "Milo", lang: "英文", gender: "男" },
      { id: "Dean", name: "Dean", lang: "英文", gender: "男" },
    ],
  },
  {
    id: "mimo-v2.5-tts-voicedesign",
    name: "MiMo-V2.5-TTS-VoiceDesign",
    description: "文字描述生成自定义音色",
    voices: [],
  },
  {
    id: "mimo-v2.5-tts-voiceclone",
    name: "MiMo-V2.5-TTS-VoiceClone",
    description: "从音频样本复制声音",
    voices: [],
  },
  {
    id: "mimo-v2-tts",
    name: "MiMo-V2-TTS",
    description: "V2 基础模型",
    voices: [
      { id: "mimo_default", name: "默认", lang: "中/英", gender: "-" },
      { id: "default_zh", name: "中文女声", lang: "中文", gender: "女" },
      { id: "default_en", name: "英文女声", lang: "英文", gender: "女" },
    ],
  },
];

/**
 * 预设风格指令
 */
const PRESET_INSTRUCTIONS = [
  { label: "温柔", value: "温柔、慢速、像在讲故事" },
  { label: "活泼", value: "活泼、欢快、语速稍快" },
  { label: "严肃", value: "严肃、正式、像在播报新闻" },
  { label: "悲伤", value: "悲伤、低沉、缓慢" },
  { label: "愤怒", value: "愤怒、语速快、音量高" },
  { label: "东北话", value: "用东北方言说，语气接地气" },
  { label: "唱歌", value: "(唱歌)" },
];

export default function TTSPage() {
  const router = useRouter();
  const { user, loading: authLoading, hasPermission } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 表单状态
  const [modelId, setModelId] = useState("mimo-v2.5-tts");
  const [voiceId, setVoiceId] = useState("冰糖");
  const [instruction, setInstruction] = useState("");
  const [text, setText] = useState("");

  // 结果状态
  const [generating, setGenerating] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [resultInfo, setResultInfo] = useState<{
    elapsed?: string;
    model?: string;
    voice?: string;
  } | null>(null);

  // 当前模型
  const currentModel = useMemo(
    () => MODELS.find((m) => m.id === modelId) || MODELS[0],
    [modelId]
  );

  // 权限检查
  React.useEffect(() => {
    if (!authLoading && user && !hasPermission(TTS_VIEW)) {
      message.warning("您没有权限访问此页面");
      router.push("/c/post");
    }
  }, [user, authLoading, hasPermission, router]);

  // 模型切换时重置音色
  const handleModelChange = useCallback(
    (value: string) => {
      setModelId(value);
      const model = MODELS.find((m) => m.id === value);
      if (model && model.voices.length > 0) {
        setVoiceId(model.voices[0].id);
      } else {
        setVoiceId("");
      }
    },
    []
  );

  // 合成语音
  const handleSynthesize = useCallback(async () => {
    if (!text.trim()) {
      message.warning("请输入要合成的文本");
      return;
    }

    setGenerating(true);
    setAudioSrc(null);
    setResultInfo(null);

    // 停止之前的播放
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      const res = await axios.post("/api/tts/synthesize", {
        text: text.trim(),
        model: modelId,
        voice: voiceId || undefined,
        instruction: instruction.trim() || undefined,
      }, {
        timeout: 60000,
      });

      if (res.data?.data?.audio) {
        const { audio, elapsed, model, voice, format } = res.data.data;
        const audioBlob = base64ToBlob(audio, `audio/${format || "wav"}`);
        const url = URL.createObjectURL(audioBlob);
        setAudioSrc(url);
        setResultInfo({ elapsed, model, voice });
        message.success("语音合成成功");
      } else {
        message.error(res.data?.message || "合成失败");
      }
    } catch (error: unknown) {
      console.error("TTS synthesis error:", error);
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "语音合成失败，请检查网络或配置";
      message.error(msg);
    } finally {
      setGenerating(false);
    }
  }, [text, modelId, voiceId, instruction]);

  // 播放/暂停
  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }, [playing]);

  // 下载
  const handleDownload = useCallback(() => {
    if (!audioSrc) return;
    const a = document.createElement("a");
    a.href = audioSrc;
    a.download = `tts_${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [audioSrc]);

  // base64 转 Blob
  function base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteArrays: BlobPart[] = [];
    const sliceSize = 1024;
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays, { type: mimeType });
  }

  // 应用预设指令
  const handlePresetClick = useCallback((value: string) => {
    setInstruction(value);
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <SoundOutlined className="text-2xl text-blue-500" />
        <h1 className="text-2xl font-bold">语音合成</h1>
        <Tag color="blue">MiMo TTS</Tag>
      </div>

      <Row gutter={[24, 16]}>
        {/* 左侧：参数配置 */}
        <Col xs={24} lg={14}>
          <Card title="参数配置" size="small">
            <div className="space-y-4">
              {/* 模型选择 */}
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-600">
                  模型
                </label>
                <Select
                  value={modelId}
                  onChange={handleModelChange}
                  className="w-full"
                  options={MODELS.map((m) => ({
                    value: m.id,
                    label: (
                      <span>
                        {m.name}
                        <span className="text-gray-400 text-xs ml-2">
                          {m.description}
                        </span>
                      </span>
                    ),
                  }))}
                />
              </div>

              {/* 音色选择 */}
              {currentModel.voices.length > 0 && (
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-600">
                    音色
                  </label>
                  <Select
                    value={voiceId}
                    onChange={setVoiceId}
                    className="w-full"
                    options={currentModel.voices.map((v) => ({
                      value: v.id,
                      label: (
                        <span>
                          {v.name}
                          <span className="text-gray-400 text-xs ml-2">
                            {v.lang} · {v.gender}
                          </span>
                        </span>
                      ),
                    }))}
                  />
                </div>
              )}

              {/* 风格指令 */}
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-600">
                  风格指令
                  <span className="text-gray-400 font-normal ml-1">
                    （可选）
                  </span>
                </label>
                <div className="mb-2 flex flex-wrap gap-1">
                  {PRESET_INSTRUCTIONS.map((preset) => (
                    <Tag
                      key={preset.label}
                      color={
                        instruction === preset.value ? "blue" : "default"
                      }
                      className="cursor-pointer"
                      onClick={() => handlePresetClick(preset.value)}
                    >
                      {preset.label}
                    </Tag>
                  ))}
                </div>
                <TextArea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="输入自然语言风格描述，如：温柔、慢速、像在讲故事"
                  rows={2}
                  maxLength={500}
                  showCount
                />
              </div>

              {/* 合成文本 */}
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-600">
                  合成文本
                  <span className="text-red-400 ml-1">*</span>
                </label>
                <TextArea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="输入需要合成语音的文本内容..."
                  rows={6}
                  maxLength={5000}
                  showCount
                />
              </div>

              {/* 生成按钮 */}
              <Button
                type="primary"
                icon={<SoundOutlined />}
                loading={generating}
                disabled={!text.trim()}
                onClick={handleSynthesize}
                size="large"
                block
              >
                {generating ? "正在生成..." : "生成语音"}
              </Button>
            </div>
          </Card>
        </Col>

        {/* 右侧：结果区 */}
        <Col xs={24} lg={10}>
          <Card title="生成结果" size="small">
            {generating && (
              <div className="flex flex-col items-center justify-center py-12">
                <Spin size="large" />
                <p className="mt-4 text-gray-500">正在合成语音，请稍候...</p>
              </div>
            )}

            {!generating && !audioSrc && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <ExperimentOutlined className="text-4xl mb-3" />
                <p>输入文本并点击「生成语音」</p>
              </div>
            )}

            {!generating && audioSrc && (
              <div className="space-y-4">
                {/* 音频播放器 */}
                <audio
                  ref={(el) => {
                    if (audioRef.current) {
                      audioRef.current.pause();
                    }
                    audioRef.current = el;
                    if (el) {
                      el.onended = () => setPlaying(false);
                    }
                  }}
                  src={audioSrc}
                  className="w-full"
                  controls
                />

                {/* 操作按钮 */}
                <Space>
                  <Button
                    icon={
                      playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />
                    }
                    onClick={handlePlayPause}
                  >
                    {playing ? "暂停" : "播放"}
                  </Button>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleDownload}
                  >
                    下载音频
                  </Button>
                  <Tooltip title="重新生成">
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={handleSynthesize}
                      loading={generating}
                    />
                  </Tooltip>
                </Space>

                {/* 元信息 */}
                {resultInfo && (
                  <div className="text-xs text-gray-400 space-y-1 pt-2 border-t">
                    {resultInfo.model && (
                      <p>模型: {resultInfo.model}</p>
                    )}
                    {resultInfo.voice && (
                      <p>音色: {resultInfo.voice}</p>
                    )}
                    {resultInfo.elapsed && (
                      <p>耗时: {resultInfo.elapsed}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
