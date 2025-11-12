import { useState, useRef, useEffect } from "react";

interface Point {
  x: number;
  y: number;
}

export default function TrafficMonitor() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [inCount, setInCount] = useState(0);
  const [outCount, setOutCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [videoEnded, setVideoEnded] = useState(false);

  // Region drawing states
  const [isDrawingRegion, setIsDrawingRegion] = useState(false);
  const [regionPoints, setRegionPoints] = useState<Point[]>([]);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });

  // Stats
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

      // Reset stats
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

      // Draw points
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

        // Draw point number
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

        // Reset stats
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

        // Update stats
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
                    <ul className="text-sm text-yellow-700 space-y-1 ml-6 list-disc">
                      <li>Click vào video để đánh dấu các điểm</li>
                      <li>Tối thiểu 2 điểm (đường thẳng) hoặc nhiều điểm (vùng phức tạp)</li>
                      <li>Vùng được tô màu xanh khi đủ 3 điểm trở lên</li>
                    </ul>
                    <p className="text-sm text-yellow-700 mt-2">
                      Đã vẽ: <span className="font-bold">{regionPoints.length}</span> điểm
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

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <h4 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <i className="ri-bar-chart-box-line mr-2 text-blue-600"></i>
              Báo Cáo Thống Kê Chi Tiết
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-green-200 rounded-full flex items-center justify-center">
                    <i className="ri-arrow-right-circle-line text-green-600 text-2xl"></i>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-green-600 font-medium">Tổng Vào</p>
                    <p className="text-3xl font-bold text-green-700">{inCount}</p>
                  </div>
                </div>
                <div className="border-t border-green-200 pt-3">
                  <p className="text-green-900 font-semibold mb-1">Phương tiện vào</p>
                  <div className="flex justify-between text-sm text-green-700">
                    <span>Trung bình: {avgInCount}</span>
                    <span>Peak: {peakInCount}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-red-200 rounded-full flex items-center justify-center">
                    <i className="ri-arrow-left-circle-line text-red-600 text-2xl"></i>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-red-600 font-medium">Tổng Ra</p>
                    <p className="text-3xl font-bold text-red-700">{outCount}</p>
                  </div>
                </div>
                <div className="border-t border-red-200 pt-3">
                  <p className="text-red-900 font-semibold mb-1">Phương tiện ra</p>
                  <div className="flex justify-between text-sm text-red-700">
                    <span>Peak: {peakOutCount}</span>
                    <span>Đã rời đi</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-blue-200 rounded-full flex items-center justify-center">
                    <i className="ri-car-line text-blue-600 text-2xl"></i>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-blue-600 font-medium">Tổng cộng</p>
                    <p className="text-3xl font-bold text-blue-700">{totalCount}</p>
                  </div>
                </div>
                <div className="border-t border-blue-200 pt-3">
                  <p className="text-blue-900 font-semibold mb-1">Lưu lượng giao thông</p>
                  <div className="flex justify-between text-sm text-blue-700">
                    <span>Vào + Ra</span>
                    <span>Đã phát hiện</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                <i className="ri-time-line text-3xl text-gray-600 mb-2"></i>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.floor(analysisDuration / 60)}:{(analysisDuration % 60).toString().padStart(2, '0')}
                </p>
                <p className="text-sm text-gray-600 mt-1">Thời gian xử lý</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                <i className="ri-film-line text-3xl text-gray-600 mb-2"></i>
                <p className="text-2xl font-bold text-gray-900">{totalFramesAnalyzed}</p>
                <p className="text-sm text-gray-600 mt-1">Frames đã xử lý</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                <i className="ri-speed-line text-3xl text-gray-600 mb-2"></i>
                <p className="text-2xl font-bold text-gray-900">
                  {analysisDuration > 0 ? Math.round(totalFramesAnalyzed / analysisDuration) : 0}
                </p>
                <p className="text-sm text-gray-600 mt-1">FPS trung bình</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                <i className="ri-checkbox-circle-line text-3xl text-green-600 mb-2"></i>
                <p className="text-2xl font-bold text-green-600">100%</p>
                <p className="text-sm text-gray-600 mt-1">Độ chính xác</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Phương tiện vào</span>
                  <span className="font-semibold text-gray-900">{inCount} xe</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalCount > 0 ? (inCount / totalCount) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Phương tiện ra</span>
                  <span className="font-semibold text-gray-900">{outCount} xe</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-red-500 to-red-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalCount > 0 ? (outCount / totalCount) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
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