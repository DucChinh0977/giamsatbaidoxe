
import { useState, useRef, useCallback, useEffect } from 'react';

interface DetectionResult {
  carCount: number;
  freeCount: number;
  timestamp: string;
}

interface Point {
  x: number;
  y: number;
}

// ========== UPLOAD AND ANALYZE COMPONENT (PARKING) ==========
function UploadAndAnalyze() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [carCount, setCarCount] = useState(0);
  const [freeCount, setFreeCount] = useState(0);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [videoEnded, setVideoEnded] = useState(false);

  const [peakCarCount, setPeakCarCount] = useState(0);
  const [avgCarCount, setAvgCarCount] = useState(0);
  const [totalFramesAnalyzed, setTotalFramesAnalyzed] = useState(0);
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
  const [analysisDuration, setAnalysisDuration] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const carCountHistory = useRef<number[]>([]);

  const handleUpload = async () => {
    if (!selectedFile) return alert("Vui lòng chọn file video!");
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("http://127.0.0.1:5000/api/parking/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setStreamUrl("http://127.0.0.1:5000/api/parking/video-stream");
        setIsStreaming(true);
        setVideoEnded(false);

        setAnalysisStartTime(Date.now());
        setPeakCarCount(0);
        setAvgCarCount(0);
        setTotalFramesAnalyzed(0);
        carCountHistory.current = [];
      } else {
        alert("Upload thất bại!");
      }
    } catch (err) {
      console.error("Lỗi upload:", err);
      alert("Không thể upload file!");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("http://127.0.0.1:5000/api/parking/current-counts");
        const data = await res.json();
        const currentCar = data.carCount || 0;
        const currentFree = data.freeCount || 0;

        setCarCount(currentCar);
        setFreeCount(currentFree);

        carCountHistory.current.push(currentCar);
        setTotalFramesAnalyzed(prev => prev + 1);

        if (currentCar > peakCarCount) {
          setPeakCarCount(currentCar);
        }

        const sum = carCountHistory.current.reduce((a, b) => a + b, 0);
        setAvgCarCount(Math.round(sum / carCountHistory.current.length));

        if (analysisStartTime) {
          setAnalysisDuration(Math.floor((Date.now() - analysisStartTime) / 1000));
        }
      } catch (error) {
        console.error("Không lấy được counts:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isStreaming, peakCarCount, analysisStartTime]);

  const handleStopStream = async () => {
    await fetch("http://127.0.0.1:5000/api/parking/stop-stream", { method: "POST" });
    setIsStreaming(false);
    setStreamUrl(null);
    setVideoEnded(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setIsStreaming(false);
      setStreamUrl(null);
      setVideoEnded(false);

      setPeakCarCount(0);
      setAvgCarCount(0);
      setTotalFramesAnalyzed(0);
      setAnalysisDuration(0);
      carCountHistory.current = [];
    }
  };

  const occupancyRate = carCount + freeCount > 0
    ? Math.round((carCount / (carCount + freeCount)) * 100)
    : 0;

  const avgOccupancyRate = avgCarCount + freeCount > 0
    ? Math.round((avgCarCount / (avgCarCount + freeCount)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900">
          <i className="ri-upload-cloud-line mr-2"></i>
          Upload & Analyze
        </h4>
        {isStreaming && (
          <button
            onClick={handleStopStream}
            className="text-red-600 hover:text-red-800 font-medium cursor-pointer flex items-center"
          >
            <i className="ri-stop-circle-line mr-1"></i> Dừng Phân Tích
          </button>
        )}
      </div>

      {!isStreaming && !videoEnded && (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!selectedFile ? (
            <div>
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-video-upload-line text-blue-600 text-3xl"></i>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer font-medium"
              >
                <i className="ri-folder-open-line mr-2"></i>
                Chọn File Video
              </button>
              <p className="text-gray-500 mt-3 text-sm">Hỗ trợ định dạng: MP4, AVI, MOV</p>
            </div>
          ) : (
            <div>
              {previewUrl && (
                <video
                  src={previewUrl}
                  controls
                  className="max-w-full max-h-64 mx-auto rounded-lg mb-4 shadow-md"
                />
              )}
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <p className="text-gray-700 font-medium mb-1">
                  <i className="ri-file-video-line mr-2 text-blue-600"></i>
                  {selectedFile.name}
                </p>
                <p className="text-sm text-gray-500">
                  Kích thước: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <div className="flex justify-center gap-4">
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer font-medium"
                >
                  {isUploading ? (
                    <>
                      <i className="ri-loader-4-line animate-spin mr-2"></i>
                      Đang tải lên...
                    </>
                  ) : (
                    <>
                      <i className="ri-play-circle-line mr-2"></i>
                      Bắt đầu Phân Tích AI
                    </>
                  )}
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-gray-600 text-white px-8 py-3 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer font-medium"
                >
                  <i className="ri-refresh-line mr-2"></i>
                  Chọn File Khác
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isStreaming && streamUrl && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <h4 className="text-xl font-semibold text-gray-900">
                Phân tích AI đang chạy...
              </h4>
            </div>

            <div className="relative max-w-4xl mx-auto border-4 border-gray-800 rounded-xl overflow-hidden shadow-2xl">
              <img
                src={streamUrl}
                alt="AI Stream"
                className="w-full"
                onError={() => setVideoEnded(true)}
              />

              <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                <div className="bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-400">{carCount}</div>
                      <div className="text-xs text-gray-300">Xe đỗ</div>
                    </div>
                    <div className="w-px h-8 bg-gray-500"></div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">{freeCount}</div>
                      <div className="text-xs text-gray-300">Chỗ trống</div>
                    </div>
                    <div className="w-px h-8 bg-gray-500"></div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">{occupancyRate}%</div>
                      <div className="text-xs text-gray-300">Sử dụng</div>
                    </div>
                  </div>
                </div>

                <div className="bg-red-600 text-white px-3 py-1 rounded-lg font-bold text-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  LIVE
                </div>
              </div>

              <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-lg text-sm font-mono">
                <i className="ri-time-line mr-1"></i>
                {Math.floor(analysisDuration / 60)}:{(analysisDuration % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Frame đã xử lý</p>
                  <p className="text-2xl font-bold text-purple-900">{totalFramesAnalyzed}</p>
                </div>
                <div className="w-12 h-12 bg-purple-200 rounded-full flex items-center justify-center">
                  <i className="ri-film-line text-purple-600 text-xl"></i>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 font-medium">Peak xe đỗ</p>
                  <p className="text-2xl font-bold text-orange-900">{peakCarCount}</p>
                </div>
                <div className="w-12 h-12 bg-orange-200 rounded-full flex items-center justify-center">
                  <i className="ri-car-line text-orange-600 text-xl"></i>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-4 border border-teal-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-teal-600 font-medium">TB xe đỗ</p>
                  <p className="text-2xl font-bold text-teal-900">{avgCarCount}</p>
                </div>
                <div className="w-12 h-12 bg-teal-200 rounded-full flex items-center justify-center">
                  <i className="ri-bar-chart-line text-teal-600 text-xl"></i>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 border border-indigo-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-indigo-600 font-medium">TB sử dụng</p>
                  <p className="text-2xl font-bold text-indigo-900">{avgOccupancyRate}%</p>
                </div>
                <div className="w-12 h-12 bg-indigo-200 rounded-full flex items-center justify-center">
                  <i className="ri-percent-line text-indigo-600 text-xl"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {videoEnded && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-6 text-white text-center shadow-lg">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-check-double-line text-4xl"></i>
            </div>
            <h3 className="text-2xl font-bold mb-2">Phân Tích Hoàn Tất!</h3>
            <p className="text-green-100">Video đã được xử lý thành công bởi AI</p>
          </div>

          <div className="text-center">
            <button
              onClick={() => {
                setSelectedFile(null);
                setVideoEnded(false);
                setPreviewUrl(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer font-medium"
            >
              <i className="ri-add-circle-line mr-2"></i>
              Phân Tích Video Mới
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== TRAFFIC MONITOR COMPONENT ==========
function TrafficMonitor() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [inCount, setInCount] = useState(0);
  const [outCount, setOutCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [videoEnded, setVideoEnded] = useState(false);

  const [isDrawingRegion, setIsDrawingRegion] = useState(false);
  const [regionPoints, setRegionPoints] = useState<Point[]>([]);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });

  const [peakInCount, setPeakInCount] = useState(0);
  const [peakOutCount, setPeakOutCount] = useState(0);
  const [avgInCount, setAvgInCount] = useState(0);
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
  const [analysisDuration, setAnalysisDuration] = useState(0);
  const [totalFramesAnalyzed, setTotalFramesAnalyzed] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inCountHistory = useRef<number[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setIsStreaming(false);
      setStreamUrl(null);
      setVideoEnded(false);
      setRegionPoints([]);
      setIsDrawingRegion(false);

      setPeakInCount(0);
      setPeakOutCount(0);
      setAvgInCount(0);
      setAnalysisDuration(0);
      setTotalFramesAnalyzed(0);
      inCountHistory.current = [];
    }
  };

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      setVideoSize({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight
      });
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRegion || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = videoSize.width / rect.width;
    const scaleY = videoSize.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    setRegionPoints(prev => [...prev, { x, y }]);
  };

  const drawRegion = () => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (regionPoints.length > 0) {
      ctx.strokeStyle = '#3B82F6';
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(
        (regionPoints[0].x / videoSize.width) * canvas.width,
        (regionPoints[0].y / videoSize.height) * canvas.height
      );

      for (let i = 1; i < regionPoints.length; i++) {
        ctx.lineTo(
          (regionPoints[i].x / videoSize.width) * canvas.width,
          (regionPoints[i].y / videoSize.height) * canvas.height
        );
      }

      if (regionPoints.length > 2) {
        ctx.closePath();
        ctx.fill();
      }

      ctx.stroke();

      regionPoints.forEach((point, idx) => {
        ctx.fillStyle = '#3B82F6';
        ctx.beginPath();
        ctx.arc(
          (point.x / videoSize.width) * canvas.width,
          (point.y / videoSize.height) * canvas.height,
          6,
          0,
          2 * Math.PI
        );
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(
          String(idx + 1),
          (point.x / videoSize.width) * canvas.width - 4,
          (point.y / videoSize.height) * canvas.height + 5
        );
      });
    }
  };

  useEffect(() => {
    drawRegion();
  }, [regionPoints, videoSize]);

  const handleUpload = async () => {
    if (!selectedFile) return alert("Vui lòng chọn file video!");
    if (regionPoints.length < 2) return alert("Vui lòng vẽ ít nhất 2 điểm cho vùng giám sát!");

    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("region_points", JSON.stringify(regionPoints.map(p => [p.x, p.y])));

    try {
      const res = await fetch("http://127.0.0.1:5000/api/traffic/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setStreamUrl("http://127.0.0.1:5000/api/traffic/video-stream");
        setIsStreaming(true);
        setVideoEnded(false);
        setIsDrawingRegion(false);

        setAnalysisStartTime(Date.now());
        setPeakInCount(0);
        setPeakOutCount(0);
        setAvgInCount(0);
        setTotalFramesAnalyzed(0);
        inCountHistory.current = [];
      } else {
        alert("Upload thất bại: " + (data.error || "Lỗi không xác định"));
      }
    } catch (err) {
      console.error("Lỗi upload:", err);
      alert("Không thể upload file!");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("http://127.0.0.1:5000/api/traffic/current-counts");
        const data = await res.json();

        setInCount(data.in_count || 0);
        setOutCount(data.out_count || 0);
        setTotalCount(data.total_count || 0);

        inCountHistory.current.push(data.in_count || 0);
        setTotalFramesAnalyzed(prev => prev + 1);

        if (data.in_count > peakInCount) setPeakInCount(data.in_count);
        if (data.out_count > peakOutCount) setPeakOutCount(data.out_count);

        const sum = inCountHistory.current.reduce((a, b) => a + b, 0);
        setAvgInCount(Math.round(sum / inCountHistory.current.length));

        if (analysisStartTime) {
          setAnalysisDuration(Math.floor((Date.now() - analysisStartTime) / 1000));
        }
      } catch (error) {
        console.error("Không lấy được counts:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isStreaming, peakInCount, peakOutCount, analysisStartTime]);

  const handleStopStream = async () => {
    await fetch("http://127.0.0.1:5000/api/traffic/stop-stream", { method: "POST" });
    setIsStreaming(false);
    setStreamUrl(null);
    setVideoEnded(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900">
          <i className="ri-upload-cloud-line mr-2"></i>
          Upload & Phân Tích Lưu Lượng Giao Thông
        </h4>
        {isStreaming && (
          <button
            onClick={handleStopStream}
            className="text-red-600 hover:text-red-800 font-medium cursor-pointer flex items-center"
          >
            <i className="ri-stop-circle-line mr-1"></i> Dừng Phân Tích
          </button>
        )}
      </div>

      {!isStreaming && !videoEnded && (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-blue-400 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!selectedFile ? (
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-video-upload-line text-blue-600 text-3xl"></i>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer font-medium"
              >
                <i className="ri-folder-open-line mr-2"></i>
                Chọn File Video
              </button>
              <p className="text-gray-500 mt-3 text-sm">Hỗ trợ định dạng: MP4, AVI, MOV</p>
            </div>
          ) : (
            <div>
              <div className="relative">
                <video
                  ref={videoRef}
                  src={previewUrl!}
                  onLoadedMetadata={handleVideoLoaded}
                  className="max-w-full max-h-96 mx-auto rounded-lg mb-4 shadow-md"
                  style={{ display: isDrawingRegion ? 'block' : 'none' }}
                />
                {isDrawingRegion && (
                  <canvas
                    ref={canvasRef}
                    width={videoRef.current?.clientWidth || 800}
                    height={videoRef.current?.clientHeight || 600}
                    onClick={handleCanvasClick}
                    className="absolute top-0 left-1/2 transform -translate-x-1/2 cursor-crosshair"
                    style={{
                      width: videoRef.current?.clientWidth || 800,
                      height: videoRef.current?.clientHeight || 600,
                    }}
                  />
                )}
              </div>

              {!isDrawingRegion && (
                <video
                  src={previewUrl!}
                  controls
                  className="max-w-full max-h-96 mx-auto rounded-lg mb-4 shadow-md"
                />
              )}

              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <p className="text-gray-700 font-medium mb-1">
                  <i className="ri-file-video-line mr-2 text-blue-600"></i>
                  {selectedFile.name}
                </p>
                <p className="text-sm text-gray-500">
                  Kích thước: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>

              {!isDrawingRegion ? (
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => setIsDrawingRegion(true)}
                    className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 transition-colors cursor-pointer font-medium"
                  >
                    <i className="ri-pencil-line mr-2"></i>
                    Vẽ Vùng Giám Sát
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-gray-600 text-white px-8 py-3 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer font-medium"
                  >
                    <i className="ri-refresh-line mr-2"></i>
                    Chọn File Khác
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-800 font-medium mb-2">
                      <i className="ri-information-line mr-2"></i>
                      Hướng dẫn vẽ vùng:
                    </p>
                    <p className="text-sm text-yellow-700">
                      Đã vẽ: <span className="font-bold">{regionPoints.length}</span> điểm (Tối thiểu: 2 điểm)
                    </p>
                  </div>

                  <div className="flex justify-center gap-4">
                    <button
                      onClick={handleUpload}
                      disabled={isUploading || regionPoints.length < 2}
                      className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer font-medium"
                    >
                      {isUploading ? (
                        <>
                          <i className="ri-loader-4-line animate-spin mr-2"></i>
                          Đang tải lên...
                        </>
                      ) : (
                        <>
                          <i className="ri-play-circle-line mr-2"></i>
                          Bắt đầu Phân Tích AI
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setRegionPoints([]);
                      }}
                      className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors cursor-pointer font-medium"
                    >
                      <i className="ri-delete-bin-line mr-2"></i>
                      Xóa Vùng
                    </button>

                    <button
                      onClick={() => setIsDrawingRegion(false)}
                      className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer font-medium"
                    >
                      <i className="ri-close-line mr-2"></i>
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isStreaming && streamUrl && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <h4 className="text-xl font-semibold text-gray-900">
                Phân tích lưu lượng giao thông đang chạy...
              </h4>
            </div>

            <div className="relative max-w-4xl mx-auto border-4 border-gray-800 rounded-xl overflow-hidden shadow-2xl">
              <img
                src={streamUrl}
                alt="AI Traffic Stream"
                className="w-full"
                onError={() => setVideoEnded(true)}
              />

              <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                <div className="bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">{inCount}</div>
                      <div className="text-xs text-gray-300">Vào</div>
                    </div>
                    <div className="w-px h-8 bg-gray-500"></div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-400">{outCount}</div>
                      <div className="text-xs text-gray-300">Ra</div>
                    </div>
                    <div className="w-px h-8 bg-gray-500"></div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">{totalCount}</div>
                      <div className="text-xs text-gray-300">Tổng</div>
                    </div>
                  </div>
                </div>

                <div className="bg-red-600 text-white px-3 py-1 rounded-lg font-bold text-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  LIVE
                </div>
              </div>

              <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-lg text-sm font-mono">
                <i className="ri-time-line mr-1"></i>
                {Math.floor(analysisDuration / 60)}:{(analysisDuration % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Peak Vào</p>
                  <p className="text-2xl font-bold text-green-900">{peakInCount}</p>
                </div>
                <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
                  <i className="ri-arrow-right-circle-line text-green-600 text-xl"></i>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 font-medium">Peak Ra</p>
                  <p className="text-2xl font-bold text-red-900">{peakOutCount}</p>
                </div>
                <div className="w-12 h-12 bg-red-200 rounded-full flex items-center justify-center">
                  <i className="ri-arrow-left-circle-line text-red-600 text-xl"></i>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">TB Vào</p>
                  <p className="text-2xl font-bold text-purple-900">{avgInCount}</p>
                </div>
                <div className="w-12 h-12 bg-purple-200 rounded-full flex items-center justify-center">
                  <i className="ri-bar-chart-line text-purple-600 text-xl"></i>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Frames</p>
                  <p className="text-2xl font-bold text-blue-900">{totalFramesAnalyzed}</p>
                </div>
                <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
                  <i className="ri-film-line text-blue-600 text-xl"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {videoEnded && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-6 text-white text-center shadow-lg">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-check-double-line text-4xl"></i>
            </div>
            <h3 className="text-2xl font-bold mb-2">Phân Tích Hoàn Tất!</h3>
            <p className="text-green-100">Video lưu lượng giao thông đã được xử lý thành công</p>
          </div>

          <div className="text-center">
            <button
              onClick={() => {
                setSelectedFile(null);
                setVideoEnded(false);
                setPreviewUrl(null);
                setRegionPoints([]);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer font-medium"
            >
              <i className="ri-add-circle-line mr-2"></i>
              Phân Tích Video Mới
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== MAIN PARKING MONITOR COMPONENT ==========
export default function ParkingMonitor() {
  const [selectedFeature, setSelectedFeature] = useState<'parking' | 'speed'>('parking');
  const [activeMode, setActiveMode] = useState<'upload' | 'camera' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('Lỗi truy cập camera:', error);
      alert('Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setDetectionResult(null);
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsProcessing(true);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      await new Promise(resolve => setTimeout(resolve, 2000));

      const result: DetectionResult = {
        carCount: Math.floor(Math.random() * 12) + 8,
        freeCount: Math.floor(Math.random() * 8) + 2,
        timestamp: new Date().toLocaleString('vi-VN')
      };

      setDetectionResult(result);
    }
    setIsProcessing(false);
  }, []);

  const resetAll = useCallback(() => {
    setActiveMode(null);
    setDetectionResult(null);
    setIsProcessing(false);
    stopCamera();
  }, [stopCamera]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          Hệ Thống AI Quản lý Phương tiện Thông Minh
        </h2>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Giải pháp AI toàn diện cho quản lý các phương tiện đi lại, từ giám sát bãi đỗ xe đến phát hiện và đếm số lượng phương tiện tham gia giao thông
        </p>
      </div>

      <div className="flex justify-center mb-8">
        <div className="bg-white rounded-full p-2 shadow-lg border border-gray-200">
          <div className="flex">
            <button
              onClick={() => {
                setSelectedFeature('parking');
                setActiveMode(null);
              }}
              className={`px-6 py-3 rounded-full font-medium transition-all duration-300 whitespace-nowrap cursor-pointer ${
                selectedFeature === 'parking'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              <i className="ri-parking-line mr-2"></i>
              Giám Sát Bãi Đỗ Xe
            </button>
            <button
              onClick={() => {
                setSelectedFeature('speed');
                setActiveMode(null);
              }}
              className={`px-6 py-3 rounded-full font-medium transition-all duration-300 whitespace-nowrap cursor-pointer ${
                selectedFeature === 'speed'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              <i className="ri-speed-line mr-2"></i>
              Giám sát lưu lượng giao thông
            </button>
          </div>
        </div>
      </div>

      {selectedFeature === 'parking' && (
        <>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-6">
                  Giám Sát Bãi Đỗ Xe Real-Time
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-4 mt-1">
                      <i className="ri-eye-line text-green-600"></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Giám Sát Real-Time</h4>
                      <p className="text-gray-600">Theo dõi tình trạng bãi đỗ xe 24/7 với công nghệ AI</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-4 mt-1">
                      <i className="ri-dashboard-line text-blue-600"></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Dashboard Thông Minh</h4>
                      <p className="text-gray-600">Giao diện trực quan hiển thị dữ liệu và thống kê</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-4 mt-1">
                      <i className="ri-notification-line text-purple-600"></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Cảnh Báo Thông Minh</h4>
                      <p className="text-gray-600">Thông báo tự động khi có thay đổi quan trọng</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <img
                  src="https://readdy.ai/api/search-image?query=Modern%20smart%20parking%20lot%20monitoring%20system%20with%20AI%20technology%2C%20aerial%20view%20of%20organized%20parking%20spaces%20with%20digital%20overlay%20showing%20real-time%20occupancy%20status%2C%20clean%20minimalist%20background%20with%20blue%20and%20white%20color%20scheme%2C%20professional%20technology%20illustration&width=600&height=400&seq=parking-monitor-1&orientation=landscape"
                  alt="Hệ thống giám sát bãi đỗ xe"
                  className="w-full h-80 object-cover object-top rounded-xl shadow-md"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl"></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-8">
            <h3 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
              AI Parking Detection System
            </h3>

            {!activeMode && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <button
                  onClick={() => setActiveMode('upload')}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-8 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 cursor-pointer group"
                >
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <i className="ri-upload-cloud-line text-3xl"></i>
                  </div>
                  <h4 className="text-xl font-semibold mb-2">Upload File</h4>
                  <p className="text-blue-100">Tải lên video hoặc hình ảnh để phân tích</p>
                </button>

                <button
                  onClick={() => setActiveMode('camera')}
                  className="bg-gradient-to-r from-green-500 to-green-600 text-white p-8 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 cursor-pointer group"
                >
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <i className="ri-camera-line text-3xl"></i>
                  </div>
                  <h4 className="text-xl font-semibold mb-2">Camera Trực Tiếp</h4>
                  <p className="text-green-100">Sử dụng camera để giám sát real-time</p>
                </button>
              </div>
            )}

            {activeMode === 'upload' && <UploadAndAnalyze />}

            {activeMode === 'camera' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-900">Camera Live Detection</h4>
                  <button
                    onClick={resetAll}
                    className="text-gray-500 hover:text-gray-700 cursor-pointer"
                  >
                    <i className="ri-close-line text-xl"></i>
                  </button>
                </div>

                <div className="bg-gray-100 rounded-xl p-6">
                  <div className="flex flex-col items-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full max-w-2xl rounded-lg shadow-md mb-4"
                      style={{ display: isCameraActive ? 'block' : 'none' }}
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {!isCameraActive ? (
                      <div className="text-center">
                        <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                          <i className="ri-camera-off-line text-gray-500 text-3xl"></i>
                        </div>
                        <button
                          onClick={startCamera}
                          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <i className="ri-camera-line mr-2"></i>
                          Bật Camera
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-4">
                        <button
                          onClick={captureAndAnalyze}
                          disabled={isProcessing}
                          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {isProcessing ? (
                            <>
                              <i className="ri-loader-4-line animate-spin mr-2"></i>
                              Đang phân tích...
                            </>
                          ) : (
                            <>
                              <i className="ri-camera-line mr-2"></i>
                              Chụp & Phân Tích
                            </>
                          )}
                        </button>
                        <button
                          onClick={stopCamera}
                          className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <i className="ri-stop-line mr-2"></i>
                          Dừng Camera
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {selectedFeature === 'speed' && (
        <>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-6">
                  Giám Sát Lưu Lượng Giao Thông
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-4 mt-1">
                      <i className="ri-speed-line text-red-600"></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Đếm Chính Xác</h4>
                      <p className="text-gray-600">Phát hiện và đếm số lượng phương tiện với độ chính xác cao</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-4 mt-1">
                      <i className="ri-camera-line text-orange-600"></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Nhận Diện Phương Tiện</h4>
                      <p className="text-gray-600">Phân loại và nhận diện các loại phương tiện khác nhau</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-4 mt-1">
                      <i className="ri-alarm-warning-line text-yellow-600"></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Cảnh Báo Ùn Tắc</h4>
                      <p className="text-gray-600">Tự động phát hiện và cảnh báo ùn tắc giao thông</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <img
                  src="https://readdy.ai/api/search-image?query=Advanced%20AI%20traffic%20monitoring%20system%20with%20vehicle%20counting%2C%20highway%20traffic%20flow%20analysis%2C%20digital%20overlay%20showing%20vehicle%20detection%20zones%2C%20professional%20technology%20visualization%20with%20blue%20and%20orange%20color%20scheme&width=600&height=400&seq=traffic-monitor-1&orientation=landscape"
                  alt="Hệ thống giám sát giao thông"
                  className="w-full h-80 object-cover object-top rounded-xl shadow-md"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl"></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-8">
            <h3 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
              AI Traffic Flow Analysis System
            </h3>
            <TrafficMonitor />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        <div className="bg-white rounded-xl shadow-md p-6 text-center border border-gray-200">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-time-line text-green-600 text-xl"></i>
          </div>
          <h4 className="text-2xl font-bold text-gray-900 mb-2">Real-Time</h4>
          <p className="text-gray-600">Xử lý liên tục</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 text-center border border-gray-200">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-brain-line text-blue-600 text-xl"></i>
          </div>
          <h4 className="text-2xl font-bold text-gray-900 mb-2">AI Powered</h4>
          <p className="text-gray-600">Công nghệ thông minh</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 text-center border border-gray-200">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-shield-check-line text-purple-600 text-xl"></i>
          </div>
          <h4 className="text-2xl font-bold text-gray-900 mb-2">Bảo Mật</h4>
          <p className="text-gray-600">An toàn dữ liệu</p>
        </div>
      </div>
    </div>
  );
}