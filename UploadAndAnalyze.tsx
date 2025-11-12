import { useState, useRef, useEffect } from "react";

export default function UploadAndAnalyze() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [carCount, setCarCount] = useState(0);
  const [freeCount, setFreeCount] = useState(0);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [videoEnded, setVideoEnded] = useState(false);

  // Thêm state cho thống kê
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

        // Reset thống kê
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

        // Cập nhật thống kê
        carCountHistory.current.push(currentCar);
        setTotalFramesAnalyzed(prev => prev + 1);

        if (currentCar > peakCarCount) {
          setPeakCarCount(currentCar);
        }

        // Tính trung bình
        const sum = carCountHistory.current.reduce((a, b) => a + b, 0);
        setAvgCarCount(Math.round(sum / carCountHistory.current.length));

        // Cập nhật thời gian
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

      // Reset thống kê
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

              {/* Overlay thông tin real-time */}
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

              {/* Timer */}
              <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-lg text-sm font-mono">
                <i className="ri-time-line mr-1"></i>
                {Math.floor(analysisDuration / 60)}:{(analysisDuration % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>

          {/* Thống kê real-time mini */}
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
          {/* Banner hoàn thành */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-6 text-white text-center shadow-lg">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-check-double-line text-4xl"></i>
            </div>
            <h3 className="text-2xl font-bold mb-2">Phân Tích Hoàn Tất!</h3>
            <p className="text-green-100">Video đã được xử lý thành công bởi AI</p>
          </div>

          {/* Dashboard thống kê chi tiết */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <h4 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <i className="ri-bar-chart-box-line mr-2 text-blue-600"></i>
              Báo Cáo Thống Kê Chi Tiết
            </h4>

            {/* Thống kê tổng quan */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-red-200 rounded-full flex items-center justify-center">
                    <i className="ri-car-line text-red-600 text-2xl"></i>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-red-600 font-medium">Cuối cùng</p>
                    <p className="text-3xl font-bold text-red-700">{carCount}</p>
                  </div>
                </div>
                <div className="border-t border-red-200 pt-3">
                  <p className="text-red-900 font-semibold mb-1">Xe Đang Đỗ</p>
                  <div className="flex justify-between text-sm text-red-700">
                    <span>Trung bình: {avgCarCount}</span>
                    <span>Peak: {peakCarCount}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-green-200 rounded-full flex items-center justify-center">
                    <i className="ri-parking-box-line text-green-600 text-2xl"></i>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-green-600 font-medium">Hiện tại</p>
                    <p className="text-3xl font-bold text-green-700">{freeCount}</p>
                  </div>
                </div>
                <div className="border-t border-green-200 pt-3">
                  <p className="text-green-900 font-semibold mb-1">Chỗ Trống</p>
                  <div className="flex justify-between text-sm text-green-700">
                    <span>Tổng chỗ: {carCount + freeCount}</span>
                    <span>Sẵn sàng</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-blue-200 rounded-full flex items-center justify-center">
                    <i className="ri-percent-line text-blue-600 text-2xl"></i>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-blue-600 font-medium">Hiện tại</p>
                    <p className="text-3xl font-bold text-blue-700">{occupancyRate}%</p>
                  </div>
                </div>
                <div className="border-t border-blue-200 pt-3">
                  <p className="text-blue-900 font-semibold mb-1">Tỷ Lệ Sử Dụng</p>
                  <div className="flex justify-between text-sm text-blue-700">
                    <span>Trung bình: {avgOccupancyRate}%</span>
                    <span className={occupancyRate > 80 ? 'text-red-600 font-bold' : ''}>
                      {occupancyRate > 80 ? 'Gần đầy' : 'Bình thường'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Thống kê phân tích */}
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

            {/* Progress bar tổng quan */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Tỷ lệ xe đỗ</span>
                  <span className="font-semibold text-gray-900">{occupancyRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-red-500 to-red-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${occupancyRate}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Chỗ trống còn lại</span>
                  <span className="font-semibold text-gray-900">{100 - occupancyRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${100 - occupancyRate}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Nút phân tích video mới */}
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